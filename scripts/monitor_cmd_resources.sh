#!/usr/bin/env bash
# 运行给定命令，并统计其运行期间的 CPU / 内存占用峰值与平均值。
#
# 用法:
#   ./scripts/monitor_cmd_resources.sh [--interval SEC] [--] <command> [args...]
#
# 环境变量:
#   SAMPLE_INTERVAL  采样间隔秒数，默认 0.01（约 100Hz）。设为 0 表示尽可能快（无 sleep）。
#
# 说明:
#   - 统计对象为命令进程及其整棵子进程树（更接近“这个程序”的真实占用）。
#   - CPU% 按“占用核数 * 100”计算，多核程序可超过 100。
#   - 内存使用物理内存 RSS（VmRSS）之和，单位 MiB。

set -euo pipefail

INTERVAL="${SAMPLE_INTERVAL:-0.01}"

usage() {
  cat <<'EOF'
用法:
  monitor_cmd_resources.sh [--interval SEC] [--] <command> [args...]

选项:
  --interval SEC   采样间隔（秒）。默认 0.01；0 表示不 sleep，采样尽可能快。
  -h, --help       显示帮助。

示例:
  monitor_cmd_resources.sh --interval 0.005 -- make -j8
  SAMPLE_INTERVAL=0 ./scripts/monitor_cmd_resources.sh ./my_app --flag
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval)
      [[ $# -ge 2 ]] || { echo "错误: --interval 需要参数" >&2; exit 2; }
      INTERVAL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "未知选项: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      break
      ;;
  esac
done

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 2
fi

if ! [[ "$INTERVAL" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "错误: 非法采样间隔: $INTERVAL" >&2
  exit 2
fi

CMD_DISPLAY="$(printf '%q ' "$@")"
CMD_DISPLAY="${CMD_DISPLAY% }"

# 读取某个 pid 的 CPU 时钟滴答（utime+stime）与 RSS（页）
read_pid_stats() {
  local pid="$1"
  local stat_line rest rss_pages utime stime statm_line
  # 注意: 不要用 $(<file 2>/dev/null)，bash 下可能导致读空
  if ! stat_line="$(cat "/proc/$pid/stat" 2>/dev/null)"; then
    return 1
  fi
  [[ -n "$stat_line" ]] || return 1
  # 去掉 "pid (comm)" 前缀；comm 可能含空格/括号
  rest="${stat_line#*)}"
  # rest 字段: 1=state ... 12=utime 13=stime
  read -r _ _ _ _ _ _ _ _ _ _ _ utime stime _ <<<"${rest}"
  [[ -n "$utime" && -n "$stime" ]] || return 1
  # RSS 页数：/proc/pid/statm 第 2 列
  if ! statm_line="$(cat "/proc/$pid/statm" 2>/dev/null)"; then
    return 1
  fi
  read -r _ rss_pages _ <<<"${statm_line}"
  [[ -n "$rss_pages" ]] || return 1
  printf '%s %s\n' "$((utime + stime))" "$rss_pages"
}

# 枚举 root 及其所有后代 pid（优先读 /proc/pid/task/tid/children）
list_descendants() {
  local root="$1"
  local -a queue=("$root")
  local -a all=()
  local -A seen=()
  local cur child children tid
  seen["$root"]=1
  while [[ ${#queue[@]} -gt 0 ]]; do
    cur="${queue[0]}"
    queue=("${queue[@]:1}")
    [[ -d "/proc/$cur" ]] || continue
    all+=("$cur")
    children=""
    for tid in "/proc/$cur/task/"*; do
      [[ -e "$tid/children" ]] || continue
      children+=" $(cat "$tid/children" 2>/dev/null || true)"
    done
    # 兼容无 children 文件的内核：回退到 ps
    if [[ -z "${children// /}" ]]; then
      children="$(ps -o pid= --ppid "$cur" 2>/dev/null || true)"
    fi
    for child in $children; do
      [[ -n "${seen[$child]+x}" ]] && continue
      seen["$child"]=1
      queue+=("$child")
    done
  done
  printf '%s\n' "${all[@]}"
}

# 汇总进程树的 CPU ticks 与 RSS 页
sample_tree() {
  local root="$1"
  local total_ticks=0
  local total_rss=0
  local pid ticks rss
  local line
  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    if line="$(read_pid_stats "$pid")"; then
      read -r ticks rss <<<"$line"
      total_ticks=$((total_ticks + ticks))
      total_rss=$((total_rss + rss))
    fi
  done < <(list_descendants "$root")
  printf '%s %s\n' "$total_ticks" "$total_rss"
}

PAGE_SIZE="$(getconf PAGESIZE)"
CLK_TCK="$(getconf CLK_TCK)"

# 启动目标命令；独立进程组，便于统一回收
set +e
setsid "$@" &
ROOT_PID=$!
set -e

if [[ -z "${ROOT_PID}" ]] || ! [[ -d "/proc/$ROOT_PID" ]]; then
  # 极短命令可能立刻退出，仍尝试 wait 拿退出码
  set +e
  wait "$ROOT_PID" 2>/dev/null
  rc=$?
  set -e
  echo "命令几乎立即退出（exit=$rc），未能采样到有效资源数据。" >&2
  exit "$rc"
fi

mem_samples=0
cpu_samples=0
sum_cpu=0
sum_rss_pages=0
peak_cpu=0
peak_rss_pages=0
cpu_anchor_ticks=""
cpu_anchor_ns=""

# 内核 CPU 时间粒度约为 1/CLK_TCK 秒；短于该窗口的差分会出现虚假尖峰
MIN_CPU_DT_NS="$(awk -v clk="$CLK_TCK" 'BEGIN { printf "%d", 1e9 / clk }')"

# 尽量用高精度时间；失败则退回 date
now_ns() {
  local ts
  if ts="$(date +%s%N 2>/dev/null)" && [[ "$ts" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$ts"
  else
    # 无 %N 时退到秒级（精度变差）
    printf '%s000000000\n' "$(date +%s)"
  fi
}

# 第一条样本只打基线
if first="$(sample_tree "$ROOT_PID")"; then
  read -r cpu_anchor_ticks _ <<<"$first"
  cpu_anchor_ns="$(now_ns)"
fi

while kill -0 "$ROOT_PID" 2>/dev/null; do
  # 先采样再 sleep，减少短进程漏采
  if cur="$(sample_tree "$ROOT_PID")"; then
    read -r cur_ticks cur_rss <<<"$cur"
    cur_ns="$(now_ns)"

    # 内存可按最高频率统计
    if [[ "$cur_rss" -gt "$peak_rss_pages" ]]; then
      peak_rss_pages="$cur_rss"
    fi
    sum_rss_pages=$((sum_rss_pages + cur_rss))
    mem_samples=$((mem_samples + 1))

    # CPU 仅在达到时钟粒度后结算，避免超高频采样虚高
    if [[ -n "$cpu_anchor_ticks" && -n "$cpu_anchor_ns" && "$cur_ns" -gt "$cpu_anchor_ns" ]]; then
      dt_ns=$((cur_ns - cpu_anchor_ns))
      if [[ "$dt_ns" -ge "$MIN_CPU_DT_NS" ]]; then
        d_ticks=$((cur_ticks - cpu_anchor_ticks))
        if [[ "$d_ticks" -lt 0 ]]; then
          d_ticks=0
        fi
        # cpu% = (d_ticks / CLK_TCK) / (dt_ns/1e9) * 100
        cpu_pct="$(awk -v dt="$d_ticks" -v clk="$CLK_TCK" -v ns="$dt_ns" \
          'BEGIN { printf "%.6f", (dt * 100000000000.0) / (clk * ns) }')"
        peak_cpu="$(awk -v a="$peak_cpu" -v b="$cpu_pct" 'BEGIN { print (b > a) ? b : a }')"
        sum_cpu="$(awk -v a="$sum_cpu" -v b="$cpu_pct" 'BEGIN { printf "%.6f", a + b }')"
        cpu_samples=$((cpu_samples + 1))
        cpu_anchor_ticks="$cur_ticks"
        cpu_anchor_ns="$cur_ns"
      fi
    fi
  else
    break
  fi

  if ! kill -0 "$ROOT_PID" 2>/dev/null; then
    break
  fi
  if [[ "$INTERVAL" != "0" && "$INTERVAL" != "0.0" ]]; then
    sleep "$INTERVAL"
  fi
done

set +e
wait "$ROOT_PID"
exit_code=$?
set -e

if [[ "$mem_samples" -eq 0 ]]; then
  echo "命令已结束，但有效采样数为 0（进程可能过短）。exit=$exit_code" >&2
  exit "$exit_code"
fi

if [[ "$cpu_samples" -gt 0 ]]; then
  avg_cpu="$(awk -v s="$sum_cpu" -v n="$cpu_samples" 'BEGIN { printf "%.3f", s / n }')"
  peak_cpu_fmt="$(awk -v p="$peak_cpu" 'BEGIN { printf "%.3f", p }')"
else
  avg_cpu="N/A"
  peak_cpu_fmt="N/A"
fi

avg_rss_mib="$(awk -v s="$sum_rss_pages" -v n="$mem_samples" -v ps="$PAGE_SIZE" \
  'BEGIN { printf "%.3f", (s / n) * ps / 1024 / 1024 }')"
peak_rss_mib="$(awk -v p="$peak_rss_pages" -v ps="$PAGE_SIZE" \
  'BEGIN { printf "%.3f", p * ps / 1024 / 1024 }')"

hz="$(awk -v iv="$INTERVAL" 'BEGIN {
  if (iv + 0 > 0) printf "%.1f", 1.0 / iv;
  else printf "max";
}')"

cat <<EOF
========== 资源统计 ==========
命令:           ${CMD_DISPLAY}
退出码:         $exit_code
内存采样次数:   $mem_samples
CPU 采样次数:   $cpu_samples
配置采样间隔:   ${INTERVAL}s (约 ${hz} Hz；CPU 最小窗口 $((MIN_CPU_DT_NS / 1000000))ms)
CPU 平均占用:   ${avg_cpu}%
CPU 峰值占用:   ${peak_cpu_fmt}%
内存平均 RSS:   ${avg_rss_mib} MiB
内存峰值 RSS:   ${peak_rss_mib} MiB
==============================
EOF

exit "$exit_code"
