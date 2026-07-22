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
    t, *vs = zip(*rows)
    fig, axes = plt.subplots(3, 1, sharex=True, figsize=(6, 7))
    for ax, v, name in zip(axes, vs, ("v1", "v2", "v3")):
        ax.plot(t, v)
        ax.set_title(name)
        ax.set_ylabel(name)
        ax.grid(True, alpha=0.3)
    axes[-1].set_xlabel("t")
    fig.tight_layout()
    if args.output:
        fig.savefig(args.output, dpi=150)
    else:
        plt.show()

if __name__ == "__main__":
    main()
