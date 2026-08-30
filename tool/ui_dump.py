#!/usr/bin/env python3
"""Parse uiautomator dump XML and print readable nodes (text / content-desc / bounds)."""
import re
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/ui.xml'
filter_empty = len(sys.argv) > 2 and sys.argv[2] == 'all'

tree = ET.parse(path)
root = tree.getroot()


def walk(node, depth=0):
    text = node.get('text') or ''
    desc = node.get('content-desc') or ''
    rid = node.get('resource-id') or ''
    cls = node.get('class') or ''
    bounds = node.get('bounds') or ''
    clickable = node.get('clickable') == 'true'
    scrollable = node.get('scrollable') == 'true'
    checked = node.get('checked') == 'true'
    enabled = node.get('enabled') != 'false'
    label = text or desc
    if label or rid or clickable or scrollable:
        if filter_empty or label or rid:
            print(f"{'  '*depth}[{cls.split('.')[-1]}] {label!r}"
                  f"{(' rid=' + rid) if rid else ''}"
                  f"{(' bounds=' + bounds) if bounds else ''}"
                  f"{' CLICK' if clickable else ''}"
                  f"{' SCROLL' if scrollable else ''}"
                  f"{' checked' if checked else ''}"
                  f"{'' if enabled else ' DISABLED'}")
    for child in node:
        walk(child, depth + 1)


walk(root)
