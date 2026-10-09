const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const grouped = new Intl.NumberFormat("en-US");

export const CATEGORIES = [
  {
    id: "ppg",
    label: "Points Per Game",
    question: "Who averages more points per game?",
    format: (value) => `${value.toFixed(1)} PPG`,
  },
  {
    id: "rpg",
    label: "Rebounds Per Game",
    question: "Who averages more rebounds per game?",
    format: (value) => `${value.toFixed(1)} RPG`,
  },
  {
    id: "apg",
    label: "Assists Per Game",
    question: "Who averages more assists per game?",
    format: (value) => `${value.toFixed(1)} APG`,
  },
  {
    id: "spg",
    label: "Steals Per Game",
    question: "Who averages more steals per game?",
    format: (value) => `${value.toFixed(1)} SPG`,
  },
  {
    id: "bpg",
    label: "Blocks Per Game",
    question: "Who averages more blocks per game?",
    format: (value) => `${value.toFixed(1)} BPG`,
  },
  {
    id: "fgPct",
    label: "Field Goal Percentage",
    question: "Who has the higher field goal percentage?",
    format: (value) => `${value.toFixed(1)}%`,
  },
  {
    id: "tpPct",
    label: "Three-Point Percentage",
    question: "Who has the higher three-point percentage?",
    format: (value) => `${value.toFixed(1)}%`,
  },
  {
    id: "ftPct",
    label: "Free Throw Percentage",
    question: "Who has the higher free throw percentage?",
    format: (value) => `${value.toFixed(1)}%`,
  },
  {
    id: "salary",
    label: "Salary",
    question: "Who has the higher salary?",
    format: (value) => currency.format(value),
  },
  {
    id: "heightIn",
    label: "Height",
    question: "Who is taller?",
    format: (value) => {
      const feet = Math.floor(value / 12);
      const inches = value % 12;
      return `${feet}'${inches}"`;
    },
  },
  {
    id: "threes",
    label: "Career Three-Pointers",
    question: "Who has more career three-pointers?",
    format: (value) => grouped.format(value),
  },
  {
    id: "careerPoints",
    label: "Career Points",
    question: "Who has more career points?",
    format: (value) => grouped.format(value),
  },
];

export function categoryById(id) {
  return CATEGORIES.find((category) => category.id === id);
}

const ONE_DECIMAL = new Set([
  "ppg",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "fgPct",
  "tpPct",
  "ftPct",
]);

export function statGap(categoryId, left, right) {
  const raw = Math.abs(left - right);
  if (ONE_DECIMAL.has(categoryId)) return Math.round(raw * 10) / 10;
  return raw;
}
