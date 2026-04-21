// src/lib/skillInference.ts
// Context-aware skill inference engine for civic issues.
// Scores from: image filename hints, title, description, category.

export const ALL_SKILLS = [
  "Road Repair",
  "Construction",
  "Civil Engineering",
  "Waste Management",
  "Sanitation",
  "Community Outreach",
  "Plumbing",
  "Electrical",
  "Environmental",
  "Animal Rescue",
  "Healthcare",
  "Fire Safety",
  "Social Work",
  "Legal Aid",
  "Education",
  "Carpentry",
  "Welding",
  "Painting",
  "Photography",
  "First Aid",
] as const;

export type Skill = (typeof ALL_SKILLS)[number];

// ── Rule definitions ─────────────────────────────────────────────────────────
// Each rule carries keywords (matched against combined text) and a weight per hit.
// Higher weight = stronger signal.

interface SkillRule {
  keywords: string[];
  skills: string[];
  weight: number;          // score added per matched keyword
  contextBoost?: string[]; // extra bonus if ANY of these also appear in text
}

const RULES: SkillRule[] = [
  // ── Roads & Pavement ──────────────────────────────────────────────────────
  {
    keywords: ["pothole", "crater", "asphalt", "tarmac", "road crack", "road damage", "pavement"],
    skills: ["Road Repair", "Civil Engineering"],
    weight: 3,
    contextBoost: ["school", "accident", "scooter", "vehicle", "bike"],
  },
  {
    keywords: ["road", "lane", "highway", "street", "footpath", "sidewalk", "divider", "median"],
    skills: ["Road Repair", "Construction"],
    weight: 1.5,
  },
  {
    keywords: ["bridge", "overpass", "flyover", "underpass", "culvert", "retaining wall"],
    skills: ["Civil Engineering", "Construction"],
    weight: 3,
  },
  {
    keywords: ["speed bump", "speed breaker", "traffic sign", "road marking", "zebra crossing", "junction"],
    skills: ["Road Repair", "Civil Engineering", "Electrical"],
    weight: 2,
  },

  // ── Sanitation & Waste ────────────────────────────────────────────────────
  {
    keywords: ["garbage", "waste", "litter", "trash", "rubbish", "dump", "dumping", "debris", "filth"],
    skills: ["Waste Management", "Sanitation"],
    weight: 3,
    contextBoost: ["public", "road", "market", "park", "residential"],
  },
  {
    keywords: ["bin", "dustbin", "overflowing", "pile", "heap", "accumulated"],
    skills: ["Waste Management", "Community Outreach"],
    weight: 2,
  },
  {
    keywords: ["drain", "sewer", "sewage", "overflow", "clog", "blocked drain", "manhole", "open sewer"],
    skills: ["Plumbing", "Civil Engineering", "Sanitation"],
    weight: 3,
  },
  {
    keywords: ["flood", "waterlog", "waterlogged", "stagnant water", "puddle", "inundation"],
    skills: ["Civil Engineering", "Plumbing", "Sanitation"],
    weight: 2.5,
  },

  // ── Water & Plumbing ──────────────────────────────────────────────────────
  {
    keywords: ["water pipe", "pipe burst", "pipe leak", "burst pipe", "water leakage", "main break"],
    skills: ["Plumbing", "Civil Engineering"],
    weight: 4,
  },
  {
    keywords: ["water supply", "no water", "water shortage", "tap", "borewell", "tanker"],
    skills: ["Plumbing", "Community Outreach"],
    weight: 2,
  },

  // ── Electrical ────────────────────────────────────────────────────────────
  {
    keywords: ["streetlight", "street light", "lamp post", "light pole", "no light", "dark road"],
    skills: ["Electrical", "Community Outreach"],
    weight: 3,
  },
  {
    keywords: ["electric wire", "live wire", "dangling wire", "sparking", "short circuit", "transformer", "power cut"],
    skills: ["Electrical"],
    weight: 4,
    contextBoost: ["dangerous", "hazard", "risk", "children"],
  },
  {
    keywords: ["power outage", "electricity", "voltage", "meter", "electric pole"],
    skills: ["Electrical", "Civil Engineering"],
    weight: 2,
  },

  // ── Environment & Trees ───────────────────────────────────────────────────
  {
    keywords: ["fallen tree", "uprooted tree", "tree fallen", "broken branch", "tree blocking"],
    skills: ["Environmental", "Community Outreach"],
    weight: 4,
  },
  {
    keywords: ["tree", "plant", "shrub", "garden", "park", "green", "leaves", "vegetation"],
    skills: ["Environmental"],
    weight: 1,
  },
  {
    keywords: ["pollution", "air quality", "smoke", "smog", "burning", "waste burning", "industrial"],
    skills: ["Environmental", "Community Outreach", "Healthcare"],
    weight: 2.5,
  },

  // ── Animals ───────────────────────────────────────────────────────────────
  {
    keywords: ["stray dog", "stray cat", "injured animal", "animal rescue", "wounded animal", "rabies"],
    skills: ["Animal Rescue", "Healthcare", "First Aid"],
    weight: 4,
  },
  {
    keywords: ["dog", "cat", "animal", "bird", "snake", "wildlife", "stray"],
    skills: ["Animal Rescue", "Community Outreach"],
    weight: 2,
  },

  // ── Healthcare & Safety ───────────────────────────────────────────────────
  {
    keywords: ["medical", "health", "hospital", "clinic", "hygiene", "disease", "contamination", "infection"],
    skills: ["Healthcare", "Sanitation"],
    weight: 3,
  },
  {
    keywords: ["fire", "flames", "burning building", "fire hazard", "gas leak", "cylinder", "explosion"],
    skills: ["Fire Safety", "Community Outreach"],
    weight: 5,
  },
  {
    keywords: ["accident", "injury", "hurt", "injured", "emergency", "first aid"],
    skills: ["First Aid", "Healthcare", "Community Outreach"],
    weight: 3,
  },

  // ── Vandalism & Infrastructure ────────────────────────────────────────────
  {
    keywords: ["graffiti", "vandalism", "spray paint", "defaced"],
    skills: ["Community Outreach", "Painting"],
    weight: 2.5,
  },
  {
    keywords: ["broken", "damaged", "smashed", "cracked wall", "collapsed", "dilapidated"],
    skills: ["Construction", "Civil Engineering"],
    weight: 2,
  },
  {
    keywords: ["bench", "public seating", "playground", "equipment broken", "fence broken"],
    skills: ["Carpentry", "Construction", "Community Outreach"],
    weight: 2.5,
  },

  // ── Social / Community ────────────────────────────────────────────────────
  {
    keywords: ["homeless", "shelter", "poverty", "beggar", "destitute", "relief"],
    skills: ["Social Work", "Community Outreach"],
    weight: 3,
  },
  {
    keywords: ["school", "education", "children", "student", "learning"],
    skills: ["Education", "Community Outreach"],
    weight: 1.5,
  },
];

// ── Category boosts ───────────────────────────────────────────────────────────
// Direct category → skill bonuses (applied on top of keyword scoring)
const CATEGORY_BOOSTS: Record<string, { skills: string[]; bonus: number }> = {
  "Road Repair":    { skills: ["Road Repair", "Construction", "Civil Engineering"], bonus: 4 },
  "Sanitation":     { skills: ["Waste Management", "Sanitation", "Community Outreach"], bonus: 4 },
  "Electrical":     { skills: ["Electrical"], bonus: 5 },
  "Plumbing":       { skills: ["Plumbing", "Civil Engineering"], bonus: 4 },
  "Animal Rescue":  { skills: ["Animal Rescue", "Healthcare", "First Aid"], bonus: 4 },
  "Environmental":  { skills: ["Environmental", "Community Outreach"], bonus: 4 },
  "Fire Safety":    { skills: ["Fire Safety", "First Aid"], bonus: 5 },
  "Healthcare":     { skills: ["Healthcare", "Sanitation", "First Aid"], bonus: 4 },
  "Community":      { skills: ["Community Outreach", "Social Work"], bonus: 3 },
  "Other":          { skills: ["Community Outreach"], bonus: 1 },
};

// ── Image filename hints ───────────────────────────────────────────────────────
// Filenames often contain descriptive words (e.g. "IMG_pothole_road.jpg")
const FILENAME_HINTS: { patterns: RegExp[]; skills: string[]; bonus: number }[] = [
  { patterns: [/pothole|road|asphalt|tarmac/i], skills: ["Road Repair", "Civil Engineering"], bonus: 3 },
  { patterns: [/garbage|waste|trash|rubbish|litter/i], skills: ["Waste Management", "Sanitation"], bonus: 3 },
  { patterns: [/drain|sewer|flood|water/i], skills: ["Plumbing", "Civil Engineering"], bonus: 3 },
  { patterns: [/light|lamp|electric|wire/i], skills: ["Electrical"], bonus: 3 },
  { patterns: [/tree|plant|green|park/i], skills: ["Environmental"], bonus: 2 },
  { patterns: [/dog|cat|animal|stray/i], skills: ["Animal Rescue", "Healthcare"], bonus: 3 },
  { patterns: [/fire|smoke|burn/i], skills: ["Fire Safety"], bonus: 4 },
  { patterns: [/crack|broken|damage|collapse/i], skills: ["Construction", "Civil Engineering"], bonus: 2 },
];

// ── Main inference function ───────────────────────────────────────────────────

export function inferSkills(
  title: string,
  description: string,
  category: string,
  imageFilename?: string
): string[] {
  const combined = `${title} ${description}`.toLowerCase();
  const scores = new Map<string, number>();

  const add = (skill: string, pts: number) =>
    scores.set(skill, (scores.get(skill) ?? 0) + pts);

  // 1. Keyword rules
  for (const rule of RULES) {
    let hits = 0;
    for (const kw of rule.keywords) {
      if (combined.includes(kw)) hits++;
    }
    if (hits > 0) {
      // Context boost: if any boost word appears, multiply score
      const boosted = rule.contextBoost?.some((w) => combined.includes(w)) ? 1.5 : 1;
      for (const skill of rule.skills) {
        add(skill, hits * rule.weight * boosted);
      }
    }
  }

  // 2. Category boosts
  const catBoost = CATEGORY_BOOSTS[category];
  if (catBoost) {
    for (const skill of catBoost.skills) {
      add(skill, catBoost.bonus);
    }
  }

  // 3. Image filename hints
  if (imageFilename) {
    for (const hint of FILENAME_HINTS) {
      if (hint.patterns.some((p) => p.test(imageFilename))) {
        for (const skill of hint.skills) {
          add(skill, hint.bonus);
        }
      }
    }
  }

  // Fallback
  if (scores.size === 0) return ["Community Outreach"];

  // Sort by score, return top 5
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skill]) => skill);
}

// ── Categories ────────────────────────────────────────────────────────────────
export const CATEGORIES = [
  "Road Repair",
  "Sanitation",
  "Electrical",
  "Plumbing",
  "Animal Rescue",
  "Environmental",
  "Fire Safety",
  "Healthcare",
  "Community",
  "Other",
] as const;

export type IssueCategory = (typeof CATEGORIES)[number];
