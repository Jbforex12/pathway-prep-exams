/**
 * Layout from certificate artwork (1024×723).
 */
const PAGE_W = 842.25;
const PAGE_H = 595.5;
const ART_W = 1024;
const ART_H = 723;

const CONTENT = {
  left: 74,
  right: 418
};

/** Clear placeholder name + course only (signature line stays on template) */
const MASKS = [
  { id: "name-text", x1: 65, x2: 395, yTop: 265, yBottom: 310, pad: 10 },
  { id: "course", x1: 65, x2: 425, yTop: 365, yBottom: 438, pad: 8 }
];

const FIELDS = {
  name: {
    x: 73,
    fieldLeft: 65,
    fieldRight: 395,
    /** Full-width blue rule; name centered on top (art px) */
    lineLeft: 80,
    lineRight: 340,
    nameBaseline: 291.5,
    maxWidth: 340 - 80,
    lineThicknessArt: 2,
    /** Space between name baseline and underline (art px) */
    lineGap: 8,
    shortFontSize: 30,
    fontSize: 26,
    minFontSize: 12
  },
  course: {
    x: CONTENT.left,
    firstBaseline: 371,
    lineHeight: 25,
    maxWidth: CONTENT.right - CONTENT.left,
    fontSize: 11.5,
    maxLines: 4
  }
};

function px(x) {
  return (x / ART_W) * PAGE_W;
}

function py(yFromTop) {
  return ((ART_H - yFromTop) / ART_H) * PAGE_H;
}

function maskRect(region, pad = region.pad ?? 5) {
  return {
    x: px(region.x1) - pad,
    y: py(region.yBottom) - pad,
    width: px(region.x2) - px(region.x1) + pad * 2,
    height: py(region.yTop) - py(region.yBottom) + pad * 2
  };
}

module.exports = {
  PAGE_W,
  PAGE_H,
  ART_W,
  ART_H,
  CONTENT,
  MASKS,
  FIELDS,
  px,
  py,
  maskRect
};
