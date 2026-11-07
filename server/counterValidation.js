export const STATUS_COUNTERS = new Map([
  "Barrier", "Assault", "Preemptive Defense", "Preemptive Strike",
  "Breakthrough", "Rapid Recovery", "Guard",
].map((label) => [label.toLocaleLowerCase(), label]));
export const COUNTER_EMOJIS = new Map([
  ["📜", "Quest"], ["🔮", "Omen"], ["🛡️", "Shield"],
  ["⚙️", "Astralia Gear"], ["💥", "Explosion"],
  ["🏆", "Renown"], ["🌌", "Advent"],
]);
const EMOJI_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export const validCounterEmoji = (emoji) => typeof emoji === "string" && emoji.length <= 32
  && [...EMOJI_SEGMENTER.segment(emoji)].length === 1
  && /\p{Extended_Pictographic}/u.test(emoji);
