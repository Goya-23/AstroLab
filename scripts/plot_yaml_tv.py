#!/usr/bin/env python3
"""读取 YAML: A.B1 -> [[t, v1, v2, v3], ...]，绘制 v1/v2/v3 随 t 变化。"""
import argparse
import matplotlib.pyplot as plt
import yaml

def main():
    p = argparse.ArgumentParser()
    p.add_argument("yaml_file")
    p.add_argument("-k", "--key", default="A.B1", help="点号路径，默认 A.B1")
    p.add_argument("-o", "--output", help="保存图片路径；省略则弹窗显示")
    args = p.parse_args()

    with open(args.yaml_file, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    node = data
    for k in args.key.split("."):
        node = node[k]
    rows = list(node)
    t, v1, v2, v3 = zip(*rows)

    plt.plot(t, v1, label="v1")
    plt.plot(t, v2, label="v2")
    plt.plot(t, v3, label="v3")
    plt.xlabel("t")
    plt.ylabel("v")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    if args.output:
        plt.savefig(args.output, dpi=150)
    else:
        plt.show()

if __name__ == "__main__":
    main()
