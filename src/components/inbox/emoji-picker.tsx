"use client";

import React, { useState, useMemo } from "react";
import { Smile, Compass, Flame, Heart, Search, HelpCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmojiItem {
  char: string;
  name: string;
  keywords: string[];
}

interface EmojiCategory {
  id: string;
  label: string;
  icon: string; // we will use emoji characters for tab icons to look exact
  emojis: EmojiItem[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Smileys & People",
    icon: "😀",
    emojis: [
      { char: "😀", name: "grinning face", keywords: ["smile", "happy", "joy", "grin"] },
      { char: "😃", name: "grinning face with big eyes", keywords: ["smile", "happy", "joy", "grin"] },
      { char: "😄", name: "grinning face with smiling eyes", keywords: ["smile", "happy", "joy", "grin"] },
      { char: "😁", name: "beaming face with smiling eyes", keywords: ["smile", "happy", "joy", "grin"] },
      { char: "😆", name: "grinning squinting face", keywords: ["smile", "happy", "joy", "grin", "haha"] },
      { char: "😅", name: "grinning face with sweat", keywords: ["smile", "happy", "sweat", "nervous"] },
      { char: "😂", name: "face with tears of joy", keywords: ["lol", "haha", "laugh", "tears", "joy"] },
      { char: "🤣", name: "rolling on the floor laughing", keywords: ["lol", "haha", "laugh", "rofl"] },
      { char: "😊", name: "smiling face with smiling eyes", keywords: ["smile", "happy", "blush", "kind"] },
      { char: "😇", name: "smiling face with halo", keywords: ["angel", "halo", "innocent", "good"] },
      { char: "🥰", name: "smiling face with hearts", keywords: ["love", "affection", "hearts", "adore"] },
      { char: "😍", name: "smiling face with heart-eyes", keywords: ["love", "hearts", "crush", "gorgeous"] },
      { char: "🤩", name: "star-struck", keywords: ["star", "excited", "wow", "amazing"] },
      { char: "😘", name: "face blowing a kiss", keywords: ["kiss", "love", "heart", "affection"] },
      { char: "😗", name: "kissing face", keywords: ["kiss", "love"] },
      { char: "😚", name: "kissing face with closed eyes", keywords: ["kiss", "love", "closed"] },
      { char: "😋", name: "face savoring food", keywords: ["yum", "delicious", "food", "tongue"] },
      { char: "😛", name: "face with tongue", keywords: ["tongue", "silly", "joke"] },
      { char: "😜", name: "winking face with tongue", keywords: ["wink", "tongue", "silly", "joke"] },
      { char: "🤪", name: "zany face", keywords: ["crazy", "silly", "goofy", "zany"] },
      { char: "🤔", name: "thinking face", keywords: ["think", "ponder", "hmm", "question"] },
      { char: "🤨", name: "face with raised eyebrow", keywords: ["suspicious", "skeptical", "eyebrow"] },
      { char: "😐", name: "neutral face", keywords: ["neutral", "meh", "flat"] },
      { char: "😑", name: "expressionless face", keywords: ["flat", "meh", "bored"] },
      { char: "😶", name: "face without mouth", keywords: ["quiet", "silent", "speechless"] },
      { char: "🙄", name: "face with rolling eyes", keywords: ["roll", "eyes", "sarcastic", "whatever"] },
      { char: "😏", name: "smirking face", keywords: ["smirk", "sly", "flirt", "confidence"] },
      { char: "😣", name: "persevering face", keywords: ["struggle", "pain", "hard"] },
      { char: "😥", name: "sad but relieved face", keywords: ["relieved", "sweat", "nervous"] },
      { char: "😮", name: "face with open mouth", keywords: ["wow", "surprised", "shocked"] },
      { char: "🤐", name: "zipper-mouth face", keywords: ["silent", "secret", "shh"] },
      { char: "😯", name: "hushed face", keywords: ["surprised", "quiet"] },
      { char: "😪", name: "sleepy face", keywords: ["sleepy", "tired", "sleep", "drool"] },
      { char: "😫", name: "tired face", keywords: ["tired", "exhausted", "done"] },
      { char: "🥱", name: "yawning face", keywords: ["yawn", "sleepy", "tired"] },
      { char: "😴", name: "sleeping face", keywords: ["sleep", "zzz", "night"] },
      { char: "😌", name: "relieved face", keywords: ["relieved", "calm", "peaceful"] },
      { char: "😜", name: "winking tongue", keywords: ["wink", "tongue"] },
      { char: "😭", name: "loudly crying face", keywords: ["cry", "sad", "tears", "upset"] },
      { char: "😱", name: "face screaming in fear", keywords: ["scream", "fear", "scared", "shocked"] },
      { char: "👍", name: "thumbs up", keywords: ["yes", "ok", "good", "agree", "like"] },
      { char: "👎", name: "thumbs down", keywords: ["no", "bad", "dislike"] },
      { char: "👊", name: "oncoming fist", keywords: ["punch", "fist", "fistbump"] },
      { char: "✌️", name: "victory hand", keywords: ["peace", "victory", "two"] },
      { char: "👌", name: "OK hand", keywords: ["ok", "perfect", "good"] },
      { char: "👋", name: "waving hand", keywords: ["wave", "hello", "hi", "bye"] },
      { char: "👏", name: "clapping hands", keywords: ["clap", "applause", "congrats"] },
      { char: "🙏", name: "folded hands", keywords: ["please", "thankyou", "pray", "hope"] },
      { char: "❤️", name: "red heart", keywords: ["love", "heart", "affection"] },
    ],
  },
  {
    id: "animals",
    label: "Animals & Nature",
    icon: "🐶",
    emojis: [
      { char: "🐶", name: "dog face", keywords: ["dog", "puppy", "pet", "animal"] },
      { char: "🐱", name: "cat face", keywords: ["cat", "kitty", "pet", "animal"] },
      { char: "🐭", name: "mouse face", keywords: ["mouse", "rat", "animal"] },
      { char: "🐹", name: "hamster", keywords: ["hamster", "pet", "animal"] },
      { char: "🐰", name: "rabbit face", keywords: ["rabbit", "bunny", "animal"] },
      { char: "🦊", name: "fox", keywords: ["fox", "animal"] },
      { char: "🐻", name: "bear", keywords: ["bear", "animal"] },
      { char: "🐼", name: "panda", keywords: ["panda", "animal"] },
      { char: "🐨", name: "koala", keywords: ["koala", "animal"] },
      { char: "🐯", name: "tiger face", keywords: ["tiger", "animal"] },
      { char: "🦁", name: "lion", keywords: ["lion", "animal"] },
      { char: "🐮", name: "cow face", keywords: ["cow", "animal"] },
      { char: "🐷", name: "pig face", keywords: ["pig", "animal"] },
      { char: "🐸", name: "frog", keywords: ["frog", "animal"] },
      { char: "🐵", name: "monkey face", keywords: ["monkey", "animal"] },
      { char: "🐔", name: "chicken", keywords: ["chicken", "animal", "bird"] },
      { char: "🐧", name: "penguin", keywords: ["penguin", "animal", "bird"] },
      { char: "🐦", name: "bird", keywords: ["bird", "animal"] },
      { char: "🦆", name: "duck", keywords: ["duck", "bird"] },
      { char: "🦅", name: "eagle", keywords: ["eagle", "bird", "hawk"] },
      { char: "🦉", name: "owl", keywords: ["owl", "bird"] },
      { char: "🦋", name: "butterfly", keywords: ["butterfly", "insect", "bug"] },
      { char: "🌹", name: "rose", keywords: ["rose", "flower", "love"] },
      { char: "🌸", name: "cherry blossom", keywords: ["flower", "cherry", "pink"] },
      { char: "🌺", name: "hibiscus", keywords: ["flower", "tropical"] },
      { char: "🌻", name: "sunflower", keywords: ["flower", "sun", "yellow"] },
      { char: "🍀", name: "four leaf clover", keywords: ["clover", "lucky", "green"] },
      { char: "🍁", name: "maple leaf", keywords: ["leaf", "autumn", "fall"] },
      { char: "🌲", name: "evergreen tree", keywords: ["tree", "forest", "nature"] },
    ],
  },
  {
    id: "food",
    label: "Food & Drink",
    icon: "🍎",
    emojis: [
      { char: "🍎", name: "red apple", keywords: ["apple", "fruit", "food"] },
      { char: "🍏", name: "green apple", keywords: ["apple", "fruit", "food"] },
      { char: "🍊", name: "tangerine", keywords: ["orange", "fruit", "food"] },
      { char: "🍋", name: "lemon", keywords: ["lemon", "fruit", "food"] },
      { char: "🍌", name: "banana", keywords: ["banana", "fruit", "food"] },
      { char: "🍉", name: "watermelon", keywords: ["watermelon", "fruit", "food"] },
      { char: "🍇", name: "grapes", keywords: ["grapes", "fruit", "food"] },
      { char: "🍓", name: "strawberry", keywords: ["strawberry", "fruit", "food"] },
      { char: "🍒", name: "cherries", keywords: ["cherries", "fruit", "food"] },
      { char: "🍑", name: "peach", keywords: ["peach", "fruit", "food"] },
      { char: "🍍", name: "pineapple", keywords: ["pineapple", "fruit", "food"] },
      { char: "🥥", name: "coconut", keywords: ["coconut", "fruit", "food"] },
      { char: "🥝", name: "kiwi fruit", keywords: ["kiwi", "fruit", "food"] },
      { char: "🍅", name: "tomato", keywords: ["tomato", "vegetable", "food"] },
      { char: "🥑", name: "avocado", keywords: ["avocado", "fruit", "food"] },
      { char: "🥕", name: "carrot", keywords: ["carrot", "vegetable", "food"] },
      { char: "🍕", name: "pizza", keywords: ["pizza", "junk", "cheese", "food"] },
      { char: "🍔", name: "hamburger", keywords: ["burger", "junk", "meat", "food"] },
      { char: "🍟", name: "french fries", keywords: ["fries", "junk", "food"] },
      { char: "🌮", name: "taco", keywords: ["taco", "mexican", "food"] },
      { char: "🍣", name: "sushi", keywords: ["sushi", "japanese", "food"] },
      { char: "🍪", name: "cookie", keywords: ["cookie", "sweet", "dessert", "food"] },
      { char: "🍩", name: "donut", keywords: ["donut", "sweet", "dessert", "food"] },
      { char: "🎂", name: "birthday cake", keywords: ["cake", "sweet", "birthday", "food"] },
      { char: "🍫", name: "chocolate bar", keywords: ["chocolate", "sweet", "food"] },
      { char: "☕", name: "hot beverage", keywords: ["coffee", "tea", "cafe", "drink"] },
      { char: "🍺", name: "beer mug", keywords: ["beer", "alcohol", "drink", "pub"] },
      { char: "🍷", name: "wine glass", keywords: ["wine", "alcohol", "drink"] },
    ],
  },
  {
    id: "activities",
    label: "Activities & Sports",
    icon: "⚽",
    emojis: [
      { char: "⚽", name: "soccer ball", keywords: ["soccer", "football", "ball", "sport"] },
      { char: "🏀", name: "basketball", keywords: ["basketball", "ball", "sport"] },
      { char: "🏈", name: "american football", keywords: ["football", "sport"] },
      { char: "⚾", name: "baseball", keywords: ["baseball", "ball", "sport"] },
      { char: "🎾", name: "tennis", keywords: ["tennis", "racket", "ball", "sport"] },
      { char: "🏐", name: "volleyball", keywords: ["volleyball", "ball", "sport"] },
      { char: "🎱", name: "pool 8 ball", keywords: ["pool", "billiards", "game"] },
      { char: "🎮", name: "video game", keywords: ["game", "controller", "play"] },
      { char: "🏆", name: "trophy", keywords: ["trophy", "winner", "prize", "first"] },
      { char: "🎨", name: "artist palette", keywords: ["art", "paint", "draw", "creativity"] },
      { char: "🎭", name: "performing arts", keywords: ["drama", "theater", "acting", "mask"] },
      { char: "🎤", name: "microphone", keywords: ["sing", "mic", "music", "karaoke"] },
      { char: "🎧", name: "headphones", keywords: ["music", "audio", "listen"] },
      { char: "🎸", name: "guitar", keywords: ["guitar", "music", "instrument"] },
      { char: "🎹", name: "musical keyboard", keywords: ["piano", "music", "instrument"] },
      { char: "📸", name: "camera with flash", keywords: ["camera", "photo", "shoot"] },
    ],
  },
  {
    id: "travel",
    label: "Travel & Places",
    icon: "🚗",
    emojis: [
      { char: "🚗", name: "automobile", keywords: ["car", "drive", "travel"] },
      { char: "🚕", name: "taxi", keywords: ["taxi", "cab", "drive", "ride"] },
      { char: "🚓", name: "police car", keywords: ["police", "cop", "car"] },
      { char: "🚑", name: "ambulance", keywords: ["ambulance", "hospital", "emergency"] },
      { char: "🚒", name: "fire engine", keywords: ["fire", "engine", "truck", "emergency"] },
      { char: "🚚", name: "delivery truck", keywords: ["truck", "deliver", "ship"] },
      { char: "🚲", name: "bicycle", keywords: ["bike", "cycle", "ride", "sport"] },
      { char: "🛵", name: "motor scooter", keywords: ["scooter", "vespa", "ride"] },
      { char: "✈️", name: "airplane", keywords: ["plane", "fly", "travel", "flight"] },
      { char: "🚀", name: "rocket", keywords: ["rocket", "space", "fly", "launch"] },
      { char: "🚁", name: "helicopter", keywords: ["helicopter", "fly"] },
      { char: "🌋", name: "volcano", keywords: ["volcano", "nature", "hot"] },
      { char: "🏖️", name: "beach with umbrella", keywords: ["beach", "umbrella", "sea", "summer", "vacation"] },
      { char: "🏕️", name: "camping", keywords: ["camp", "tent", "forest"] },
      { char: "🏠", name: "house", keywords: ["house", "home", "building"] },
      { char: "🏢", name: "office building", keywords: ["office", "work", "building"] },
      { char: "🏛️", name: "classical building", keywords: ["museum", "court", "building"] },
    ],
  },
  {
    id: "objects",
    label: "Objects & Lights",
    icon: "💡",
    emojis: [
      { char: "💡", name: "light bulb", keywords: ["bulb", "light", "idea", "creative"] },
      { char: "🕯️", name: "candle", keywords: ["candle", "light", "wax"] },
      { char: "🔦", name: "flashlight", keywords: ["flashlight", "torch", "light"] },
      { char: "🔑", name: "key", keywords: ["key", "lock", "access", "secure"] },
      { char: "🔒", name: "locked", keywords: ["lock", "secure", "private"] },
      { char: "🔓", name: "unlocked", keywords: ["lock", "open", "access"] },
      { char: "🔨", name: "hammer", keywords: ["hammer", "tool", "build", "fix"] },
      { char: "🔧", name: "wrench", keywords: ["wrench", "tool", "fix", "mechanic"] },
      { char: "🛡️", name: "shield", keywords: ["shield", "protect", "defense", "safety"] },
      { char: "✉️", name: "envelope", keywords: ["mail", "letter", "post", "email"] },
      { char: "📦", name: "package", keywords: ["package", "box", "deliver", "ship"] },
      { char: "✏️", name: "pencil", keywords: ["pencil", "write", "draw"] },
      { char: "📌", name: "pushpin", keywords: ["pin", "pushpin", "note", "board"] },
      { char: "📎", name: "paperclip", keywords: ["clip", "paperclip", "attach", "file"] },
      { char: "📂", name: "open file folder", keywords: ["folder", "file", "directory"] },
      { char: "🗑️", name: "wastebasket", keywords: ["trash", "bin", "delete"] },
    ],
  },
  {
    id: "symbols",
    label: "Symbols & Hearts",
    icon: "❤️",
    emojis: [
      { char: "❤️", name: "red heart", keywords: ["love", "heart", "passion"] },
      { char: "🧡", name: "orange heart", keywords: ["love", "heart"] },
      { char: "💛", name: "yellow heart", keywords: ["love", "heart"] },
      { char: "💚", name: "green heart", keywords: ["love", "heart"] },
      { char: "💙", name: "blue heart", keywords: ["love", "heart"] },
      { char: "💜", name: "purple heart", keywords: ["love", "heart"] },
      { char: "🖤", name: "black heart", keywords: ["love", "heart"] },
      { char: "🔥", name: "fire", keywords: ["fire", "hot", "cool", "lit"] },
      { char: "✨", name: "sparkles", keywords: ["sparkle", "stars", "shiny", "magic"] },
      { char: "🌟", name: "glowing star", keywords: ["star", "glow"] },
      { char: "💥", name: "collision", keywords: ["boom", "explode", "bang"] },
      { char: "💯", name: "hundred points", keywords: ["100", "perfect", "excellent", "deal"] },
      { char: "💤", name: "zzz", keywords: ["sleep", "tired", "snore"] },
      { char: "💬", name: "speech balloon", keywords: ["chat", "talk", "bubble", "message"] },
      { char: "⚠️", name: "warning", keywords: ["warning", "alert", "danger"] },
      { char: "⛔", name: "no entry", keywords: ["stop", "limit", "restrict"] },
    ],
  },
  {
    id: "flags",
    label: "Flags",
    icon: "🏁",
    emojis: [
      { char: "🏁", name: "chequered flag", keywords: ["race", "finish", "flag"] },
      { char: "🚩", name: "triangular flag", keywords: ["flag", "mark", "alert"] },
      { char: "🏳️‍🌈", name: "rainbow flag", keywords: ["rainbow", "lgbt", "pride"] },
      { char: "🇺🇸", name: "United States", keywords: ["us", "usa", "america", "flag"] },
      { char: "🇬🇧", name: "United Kingdom", keywords: ["uk", "britain", "flag"] },
      { char: "🇮🇳", name: "India", keywords: ["india", "flag"] },
      { char: "🇩🇪", name: "Germany", keywords: ["germany", "flag"] },
      { char: "🇫🇷", name: "France", keywords: ["france", "flag"] },
      { char: "🇪🇸", name: "Spain", keywords: ["spain", "flag"] },
      { char: "🇮🇹", name: "Italy", keywords: ["italy", "flag"] },
      { char: "🇯🇵", name: "Japan", keywords: ["japan", "flag"] },
      { char: "🇰🇷", name: "South Korea", keywords: ["korea", "flag"] },
      { char: "🇨🇳", name: "China", keywords: ["china", "flag"] },
      { char: "🇧🇷", name: "Brazil", keywords: ["brazil", "flag"] },
      { char: "🇨🇦", name: "Canada", keywords: ["canada", "flag"] },
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeTab, setActiveTab] = useState("smileys");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase().trim();
    const results: EmojiItem[] = [];

    EMOJI_CATEGORIES.forEach((cat) => {
      cat.emojis.forEach((em) => {
        if (
          em.name.includes(query) ||
          em.keywords.some((kw) => kw.includes(query)) ||
          em.char === query
        ) {
          results.push(em);
        }
      });
    });

    return results;
  }, [searchQuery]);

  return (
    <div className="flex w-full flex-col rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-2xl backdrop-blur-lg select-none">
      {/* Category Tabs */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveTab(cat.id);
                setSearchQuery("");
              }}
              title={cat.label}
              className={cn(
                "rounded-lg p-2 text-lg hover:bg-slate-900 transition-colors",
                activeTab === cat.id && !searchQuery
                  ? "bg-primary/20 border-b-2 border-primary"
                  : "opacity-60 hover:opacity-100"
              )}
            >
              {cat.icon}
            </button>
          ))}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-200 px-2 py-1 hover:bg-slate-900 rounded-md transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative mt-2">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          <Search className="h-3.5 w-3.5" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search emojis..."
          className="w-full rounded-lg border border-slate-800 bg-slate-900/40 py-1.5 pl-9 pr-4 text-xs text-white placeholder-slate-500 outline-none transition-colors focus:border-primary/50"
        />
      </div>

      {/* Emojis Grid Container */}
      <div className="mt-3 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {filteredEmojis !== null ? (
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Search Results ({filteredEmojis.length})
            </div>
            {filteredEmojis.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-600 flex flex-col items-center gap-1.5">
                <HelpCircle className="h-5 w-5 text-slate-700" />
                <span>No emojis found</span>
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {filteredEmojis.map((em) => (
                  <button
                    key={em.char}
                    type="button"
                    onClick={() => onSelect(em.char)}
                    title={em.name}
                    className="flex aspect-square items-center justify-center rounded text-2xl hover:bg-slate-850 active:scale-95 transition-all"
                  >
                    {em.char}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {EMOJI_CATEGORIES.map((cat) => {
              if (cat.id !== activeTab) return null;
              return (
                <div key={cat.id}>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    {cat.label}
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {cat.emojis.map((em) => (
                      <button
                        key={em.char}
                        type="button"
                        onClick={() => onSelect(em.char)}
                        title={em.name}
                        className="flex aspect-square items-center justify-center rounded text-2xl hover:bg-slate-850 active:scale-95 transition-all"
                      >
                        {em.char}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
