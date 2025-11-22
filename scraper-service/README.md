# Dota 2 Voice Line Scraper

A simple command-line script for scraping Dota 2 hero voice lines from the Dota 2 wiki and downloading them locally.

## Features

- Scrapes voice lines from [Dota 2 Wiki - Category:Responses](https://dota2.fandom.com/wiki/Category:Responses)
- Generates JSON files with links, names, and categories (no file downloading)
- Dynamically detects categories from page headings
- Extracts voice line text (text beside play buttons)
- Creates organized JSON structure for easy reference
- Simple command-line interface

## Usage

Run the scraper from the project root:

```bash
npm run scrape
```

That's it! The script will:
1. Fetch all hero pages from the Dota 2 wiki category page
2. For each hero, extract all audio file links
3. Extract voice line names (text beside play buttons)
4. Detect categories dynamically from page headings
5. Generate a JSON file with links, names, and categories
6. Save all heroes to a single file: `assets/voice-lines/voice-lines.json`

## Output Structure

After scraping, a **single JSON file** is created with all heroes:

```
assets/
└── voice-lines/
    └── voice-lines.json  (single file with all heroes)
```

The `voice-lines.json` file contains:
- **`heroes`**: Array of all heroes with their voice lines
  - Each hero has:
    - `hero`: Hero name
    - `url`: Source URL
    - `voiceLines`: Array of voice lines (with `name`, `link`, `category`, `subCategory`)
    - `categories`: Map of categories with counts
    - `totalFiles`: Number of voice lines for this hero
    - `scrapedAt`: Timestamp
- **`totalHeroes`**: Total number of heroes
- **`totalVoiceLines`**: Total number of voice lines across all heroes
- **`scrapedAt`**: Overall scrape timestamp

### Example JSON Structure:

```json
{
  "heroes": [
    {
      "hero": "Abaddon",
      "url": "https://dota2.fandom.com/wiki/Abaddon/Responses",
      "voiceLines": [
        {
          "name": "Abaddon.",
          "link": "https://dota2.fandom.com/wiki/File:Abaddon_loadout_01.ogg",
          "category": "Loadout"
        },
        {
          "name": "Lord of Avernus.",
          "link": "https://dota2.fandom.com/wiki/File:Abaddon_loadout_02.ogg",
          "category": "Loadout"
        },
        {
          "name": "Abaddon.",
          "link": "https://dota2.fandom.com/wiki/File:Abaddon_drafting_picked.ogg",
          "category": "Drafting",
          "subCategory": "Picked"
        }
      ],
      "categories": {
        "Loadout": { "count": 11 },
        "Drafting": {
          "subCategories": ["Picked", "Banned"],
          "count": 2
        }
      },
      "totalFiles": 100,
      "scrapedAt": "2025-11-22T..."
    }
  ],
  "totalHeroes": 124,
  "totalVoiceLines": 12000,
  "scrapedAt": "2025-11-22T..."
}
```

**Note**: Categories are dynamically detected from page headings (h2, h3, h4). Voice lines without a detected category are assigned to "misc".

## Example Output

```
🚀 Starting Dota 2 Voice Line Scraper...

📁 Output directory: /path/to/assets/voice-lines

📡 Fetching hero list from category page...
✅ Found 124 unique hero pages

[1/124] 🎭 Scraping Abaddon...
  🔗 Source: https://dota2.fandom.com/wiki/Abaddon/Responses
────────────────────────────────────────────────────────────
  📦 Found 15 audio links
  [1/15] 📝 Processing Abaddon... ✅
  [2/15] 📝 Processing Lord of Avernus... ✅
  [3/15] 📝 Processing This place appears like a vision... ✅
  [4/15] 📝 Processing Abaddon... ✅
  ...
  📊 Summary for Abaddon:
     📝 Processed: 15 voice lines
     📂 Categories: 8
💾 All data saved to: assets/voice-lines/voice-lines.json

[2/124] 🎭 Scraping Pudge...
────────────────────────────────────────────────────────────
  📦 Found 12 audio links
  [1/12] ⬇️  Downloading attack... ✅
  [2/12] ⬇️  Downloading respawn... ✅
  ...
  📊 Summary for Pudge:
     ✅ Downloaded: 12
     📁 Total files: 12

...

============================================================
✨ Scraping completed!
============================================================
📊 Final Stats:
   🎭 Heroes scraped: 124
   📁 Total files: 1500
   ❌ Errors: 0
   ⏱️  Duration: 2m 5s
📁 Files saved to: /path/to/assets/voice-lines
============================================================
```

## Notes

- The scraper runs **locally only** - no API or database connection required
- JSON files are saved to `assets/voice-lines/hero-name/` directory
- The scraper includes delays between requests to avoid overwhelming the wiki server
- No files are downloaded - only JSON metadata with links is generated
- Scraping may take a while depending on the number of heroes and voice lines
- Progress is shown in real-time as it processes each hero
- Categories are dynamically detected from page structure

## Troubleshooting

### Path Issues
The scraper automatically detects the correct path to `assets/voice-lines/` based on where it's running from. Make sure you run it from the project root.

### Missing Categories
If voice lines are not being categorized correctly, they will be assigned to "misc". The scraper dynamically detects categories from page headings, so structure may vary between heroes.

### Network Timeouts
If you encounter network timeout errors, the script will continue with the next hero. You can run the scraper again to regenerate JSON files.
