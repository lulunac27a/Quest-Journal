// src/core/achievementAnimations.js

// ✅ لوتی‌ها را مستقیم ایمپورت می‌کنیم تا Vite مسیر درست بسازد:
import moneyTreeUrl from "../assets/Lottie/Money Tree Green.lottie";
import nostradamusUrl from "../assets/Lottie/Nostradamus.lottie";
import synthRunnerUrl from "../assets/Lottie/SynthRunner.lottie";
import campFireUrl from "../assets/Lottie/Summer Camp Animations - Camp Fire.lottie";
import ufoUrl from "../assets/Lottie/UFO Camping Scene.lottie";
import magicianUrl from "../assets/Lottie/Magician.lottie";
import catUrl from "../assets/Lottie/Cat playing animation.lottie";
import lifeUrl from "../assets/Lottie/life.lottie";

// 🚫 حذف Fallback عمومی (قبلاً moneyTreeUrl بود)
// فقط برای Task Starter از Money Tree استفاده می‌کنیم
// اگر انیمیشن خاصی وجود نداشت، هیچ انیمیشنی پلی نمی‌شود

export const ACHIEVEMENT_ANIMATIONS = {
  // 🎋 فقط Task Starter باید Money Tree داشته باشد
  "Task Starter": {
    url: moneyTreeUrl,
    message: "You've started your Adventure today! Good luck on this majestic path.",
  },

  "Early Bird": {
    url: nostradamusUrl,
    message: "What are you doing here so early? I thought I was alone in this hour in these lands.",
  },

  "Task Sprinter": {
    url: synthRunnerUrl,
    message: "Just cruising along the day! Doing awesome, dude.",
  },

  "Friendly Face": {
    url: campFireUrl,
    message: "You have some FRIENDS, I see! Good, good.",
  },

  "Curious Mind": {
    url: ufoUrl,
    message: "You're finding out things you shouldn't! Come with us.",
  },

  "Deal Maker": {
    url: magicianUrl,
    message: "Hocus pocus, profits focus!",
  },

  "Three-in-a-Row": {
    url: catUrl,
    message: "Hey! Do you want a new pet?",
  },

  "Morning Master": {
    url: lifeUrl,
    message: "It's a beautiful day, huh? Don't let it slip away!",
  },

  // Journal achievements
  "First Page": {
    url: moneyTreeUrl,
    message: "You opened your journal. First step of many!",
  },
  "Daily Scribe": {
    url: campFireUrl,
    message: "Two days in a row — the story grows.",
  },
  "Inked Five": {
    url: synthRunnerUrl,
    message: "Five-day streak — the ink is flowing!",
  },
  "Week of Words": {
    url: catUrl,
    message: "A full week of writing. Keep the flame alive!",
  },
  "Fortnight Scribe": {
    url: magicianUrl,
    message: "Fourteen days — habits forged in ink.",
  },
  "Ten-Thousand Words": {
    url: nostradamusUrl,
    message: "10,000 words — your saga takes shape.",
  },
  "Twenty-Thousand Words": {
    url: lifeUrl,
    message: "20,000 words — an epic in motion!",
  },
};

/**
 * گرفتن انیمیشن متناظر با نام اچیومنت
 * - اگر وجود نداشته باشد، هیچ انیمیشنی برنمی‌گرداند
 */
export function getAchievementAnimation(name) {
  if (!name) return { url: null, message: "" };

  // تطبیق دقیق
  const exact = ACHIEVEMENT_ANIMATIONS[name];
  if (exact) return { ...exact };

  // تطبیق نرم‌تر (بدون حساسیت به حروف و فاصله)
  const norm = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(ACHIEVEMENT_ANIMATIONS)) {
    if (k.toLowerCase().trim() === norm) return { ...v };
  }

  // ❌ هیچ انیمیشنی وجود ندارد
  return { url: null, message: "" };
}
