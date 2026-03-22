---
name: social-posting
description: Daily Scripture + Protocol Metrics Social Post Generator. Creates mission-aligned content that pairs a daily Bible verse with Jubilee Protocol TVL and market metrics for @JubileeLabsBot.
---

# Social Posting Skill

## Purpose
Generate daily social media posts for @JubileeLabsBot that combine:
1. A daily Scripture verse (KJV)
2. Protocol TVL and market metrics from CoinGecko/CMC
3. A brief builder update or insight

## Post Format

```
📖 Daily Word

"[Verse text]"
— [Book Chapter:Verse] (KJV)

📊 Protocol Pulse
• TVL: $X.XXM
• jBTCi APY: X.X%
• jUSDi APY: X.X%
• JUBL: $X.XX

🔨 Builder Note
[1-sentence update on protocol development]

#Jubilee #DeFi #ChristianFinance #BuildInPublic
```

## Instructions

### Step 1: Get Daily Verse
- Use the `bible_lookup` tool to fetch today's verse.
- Rotate through these books: Proverbs, Psalms, Isaiah, Matthew, Romans, Hebrews, Leviticus 25.
- Select a verse that relates to stewardship, justice, provision, or jubilee themes.

### Step 2: Get Protocol Metrics
- Use `web_search` to find current Jubilee Protocol TVL from DeFiLlama, CoinGecko, or CMC.
- Look for jBTCi and jUSDi vault APYs on mint.jbtci.xyz and base.jusdi.xyz.
- Get JUBL token price if listed.
- If metrics are unavailable, use placeholder: "Data coming soon."

### Step 3: Compose the Post
- Keep under 280 characters for the X/Twitter version.
- Create a longer version (under 500 chars) for Farcaster/Lens.
- Tone: humble, builder-focused, faith-grounded. Never hype.
- Never reference token price as investment advice.

### Step 4: Save to Drafts
- Write the post to `drafts/daily-posts/YYYY-MM-DD.md`
- Include both short (X) and long (Farcaster) versions.
- Add metadata: date, verse reference, metrics snapshot.

## Safety
- Never promise returns or yield percentages as guaranteed.
- All Scripture must be accurately quoted (KJV).
- No engagement bait, giveaway announcements, or price predictions.
- Every post must pass Prophet Guard ethical check.
