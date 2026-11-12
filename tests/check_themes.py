"""Theme drift guard: index.html options, CSS blocks and README must agree."""
from __future__ import annotations

import re
import sys


def main() -> int:
    css = open("css/styles.css").read()
    html = open("index.html").read()
    readme = open("README.md").read()

    css_themes = set(re.findall(r'\[data-theme="([a-z]+)"\]', css))
    options = re.findall(r'<option value="([a-z]+)">([^<]+)</option>', html)
    option_values = {value for value, _ in options} - {"system"}

    missing_css = sorted(option_values - css_themes)
    missing_option = sorted(css_themes - option_values)
    if missing_css or missing_option:
        print(f"theme drift: option-only={missing_css} css-only={missing_option}")
        return 1

    if len(option_values) != 15:
        print(f"expected 15 themes, found {len(option_values)}: {sorted(option_values)}")
        return 1

    for _, label in options:
        plain = re.sub(r"\s*\(.*\)", "", label)
        if plain not in readme:
            print(f"README is missing the theme label: {plain}")
            return 1

    print("check-themes: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
