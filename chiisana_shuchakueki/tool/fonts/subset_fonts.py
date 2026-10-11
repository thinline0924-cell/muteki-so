"""アプリで使う文字だけを残したフォントを作る(開発用)。

    pip install fonttools
    python3 tool/fonts/subset_fonts.py

- 元のフォント(Zen Maru Gothic、SIL Open Font License 1.1)を Google Fonts から取ってくる
- lib/ と assets/ の中で使っている文字 + ひらがな・カタカナ・英数字・記号を残す
- assets/fonts/ に書き出し、残した文字の一覧を assets/fonts/charset.txt に書く
  (test/ui/font_test.dart が「使っている文字がすべてフォントにあるか」を確かめる)
"""
import pathlib
import urllib.request

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "tool" / "fonts" / "src"
OUT = ROOT / "assets" / "fonts"

URLS = {
    "Medium": "https://fonts.gstatic.com/s/zenmarugothic/v20/o-0XIpIxzW5b-RxT-6A8jWAtCp-cGWtCPA.ttf",
    "Bold": "https://fonts.gstatic.com/s/zenmarugothic/v20/o-0XIpIxzW5b-RxT-6A8jWAtCp-cUW1CPA.ttf",
    "Black": "https://fonts.gstatic.com/s/zenmarugothic/v20/o-0XIpIxzW5b-RxT-6A8jWAtCp-caW9CPA.ttf",
}


def used_chars() -> set[str]:
    chars: set[str] = set()
    for folder, pattern in [("lib", "*.dart"), ("assets", "*.json")]:
        for f in (ROOT / folder).rglob(pattern):
            chars.update(f.read_text(encoding="utf-8"))
    # いつでも使えるようにしておく文字
    ranges = [
        (0x20, 0x7E),  # 英数字・記号
        (0x3000, 0x303F),  # 和文の記号
        (0x3040, 0x309F),  # ひらがな
        (0x30A0, 0x30FF),  # カタカナ
        (0xFF01, 0xFF5E),  # 全角英数字
        (0x2190, 0x2193),  # 矢印
    ]
    for a, b in ranges:
        chars.update(chr(c) for c in range(a, b + 1))
    chars.update("★☆×÷・〒♪…—〜「」『』【】、。！？（）")
    return {c for c in chars if c >= " " and c not in "\u007f"}


def main() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    chars = used_chars()
    text = "".join(sorted(chars))
    for weight, url in URLS.items():
        src = SRC / f"{weight}.ttf"
        if not src.exists():
            print("download", url)
            urllib.request.urlretrieve(url, src)
        out = OUT / f"ZenMaruGothic-{weight}.ttf"
        opts = subset.Options()
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        font = subset.load_font(str(src), opts)
        s = subset.Subsetter(opts)
        s.populate(text=text)
        s.subset(font)
        subset.save_font(font, str(out), opts)
        print(out.name, out.stat().st_size // 1024, "KB")
    # フォントに実際に入った文字だけを書く
    from fontTools.ttLib import TTFont

    cmap = TTFont(str(OUT / "ZenMaruGothic-Bold.ttf")).getBestCmap()
    covered = "".join(sorted(chr(c) for c in cmap if chr(c) in chars))
    (OUT / "charset.txt").write_text(covered, encoding="utf-8")
    print("文字数", len(covered))


if __name__ == "__main__":
    main()
