#!/usr/bin/env node

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs-extra';
import * as path from 'path';

interface VoiceLineEntry {
  name: string; // Voice line text (text beside play button)
  link: string; // URL to the audio file
  category: string; // Main category (e.g., "Loadout", "Drafting")
  subCategory?: string; // Subcategory if exists (e.g., "Picked", "Banned")
}

interface HeroVoiceLines {
  hero: string;
  url: string;
  voiceLines: VoiceLineEntry[];
  categories: Record<string, { subCategories?: string[]; count: number }>;
  totalFiles: number;
  scrapedAt: string;
}

interface AllHeroesVoiceLines {
  heroes: HeroVoiceLines[];
  totalHeroes: number;
  totalVoiceLines: number;
  scrapedAt: string;
}

interface AudioLinkInfo {
  url: string;
  linkText?: string;
  responseType?: string;
  category?: string; // e.g., "Loadout", "Drafting"
  subCategory?: string; // e.g., "Picked", "Banned"
  voiceLineText?: string; // Text beside the play button
}

const BASE_URL = 'https://dota2.fandom.com';
const CATEGORY_URL = `${BASE_URL}/wiki/Category:Responses`;

// Get the voice lines directory path
function getVoiceLinesDir(): string {
  const cwd = process.cwd();
  // If running from scraper-service folder
  if (cwd.includes('scraper-service')) {
    return path.join(cwd, '..', 'assets', 'voice-lines');
  }
  // If running from root
  return path.join(cwd, 'assets', 'voice-lines');
}

// Extract hero name from URL
function extractHeroNameFromUrl(url: string): string | null {
  const match = url.match(/\/wiki\/([^\/]+)\/Responses/);
  if (match && match[1]) {
    return match[1].replace(/_/g, ' ').trim();
  }
  return null;
}

// Sanitize file name
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

// Delay utility
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Get all hero pages from the category page
async function getHeroPages(): Promise<Array<{ heroName: string; url: string }>> {
  console.log('📡 Fetching hero list from category page...');
  
  try {
    const response = await axios.get(CATEGORY_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    const heroPages: Array<{ heroName: string; url: string }> = [];

    // Find all links to hero response pages
    $('a[href*="/Responses"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && href.includes('/Responses')) {
        const heroName = extractHeroNameFromUrl(href);
        if (heroName) {
          const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
          heroPages.push({ heroName, url: fullUrl });
        }
      }
    });

    // Remove duplicates
    const uniqueHeroes = Array.from(
      new Map(heroPages.map((h) => [h.heroName, h])).values()
    );

    console.log(`✅ Found ${uniqueHeroes.length} unique hero pages`);
    return uniqueHeroes;
  } catch (error) {
    console.error('❌ Failed to fetch category page:', error);
    throw error;
  }
}

// Removed download functions - we're only generating JSON now

// Scrape a single hero page for voice lines
async function scrapeHeroPage(
  heroPage: { heroName: string; url: string },
  index: number,
  total: number
): Promise<HeroVoiceLines> {
  try {
    const response = await axios.get(heroPage.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);

    // Find all audio file links with context
    const audioLinksInfo = new Map<string, AudioLinkInfo>();

    // Build a map of all section headings on the page
    const sectionMap = new Map<string, { level: number; parent?: string }>();
    const headings: Array<{ text: string; level: number; id?: string }> = [];
    
    // Find all headings (h2, h3, h4) with their hierarchy
    $('h2, h3, h4, .mw-heading2, .mw-heading3, .mw-heading4').each((_, element) => {
      const $heading = $(element);
      const text = $heading.text().trim();
      
      // Skip "Contents" heading
      if (text.toLowerCase() === 'contents') return;
      
      // Determine level (h2 = 1, h3 = 2, h4 = 3)
      const tagName = (element as any).tagName?.toLowerCase() || '';
      let level = 1;
      if (tagName.includes('3') || $heading.hasClass('mw-heading3')) level = 2;
      if (tagName.includes('4') || $heading.hasClass('mw-heading4')) level = 3;
      
      const id = $heading.attr('id') || $heading.attr('data-mw-heading-id');
      
      headings.push({ text, level, id: id || undefined });
      sectionMap.set(text, { level });
    });

    // Build parent-child relationships
    let currentParent: string | undefined;
    for (const heading of headings) {
      if (heading.level === 1) {
        currentParent = heading.text;
      } else if (heading.level === 2 && currentParent) {
        sectionMap.set(heading.text, { level: heading.level, parent: currentParent });
      }
    }

    // Helper function to find section category by traversing up the DOM tree
    const findSectionCategory = ($element: cheerio.Cheerio): { category: string; subCategory?: string } => {
      let category: string | undefined;
      let subCategory: string | undefined;

      // Find the closest heading (h2, h3, h4) above this element
      let $current = $element;
      const headingStack: Array<{ text: string; level: number }> = [];

      // Traverse up the DOM to find all headings
      for (let i = 0; i < 15; i++) {
        // Look for headings before this element
        const $prevHeading = $current.prevAll('h2, h3, h4, .mw-heading2, .mw-heading3, .mw-heading4').first();
        
        if ($prevHeading.length) {
          const headingText = $prevHeading.text().trim();
          if (headingText.toLowerCase() !== 'contents') {
            const tagName = ($prevHeading[0] as any)?.tagName?.toLowerCase() || '';
            let level = 1;
            if (tagName.includes('3') || $prevHeading.hasClass('mw-heading3')) level = 2;
            if (tagName.includes('4') || $prevHeading.hasClass('mw-heading4')) level = 3;
            
            headingStack.push({ text: headingText, level });
          }
        }

        // Check if we're inside a section with a heading parent
        const $parentSection = $current.closest('[id^="mw-content-text"]').find('h2, h3, h4');
        
        $current = $current.parent();
        if (!$current.length || $current.is('body') || $current.is('html')) break;
      }

      // Sort headings by level (h2 first, then h3, then h4)
      headingStack.sort((a, b) => a.level - b.level);

      // Find the main category (h2 or h3, level 1 or 2)
      const mainHeading = headingStack.find(h => h.level === 1) || headingStack.find(h => h.level === 2) || headingStack[0];
      if (mainHeading) {
        category = mainHeading.text;
        
        // Check if there's a subcategory (level 3)
        const subHeading = headingStack.find(h => h.level === 3);
        if (subHeading && sectionMap.has(subHeading.text)) {
          const subInfo = sectionMap.get(subHeading.text);
          // Only use subcategory if it's actually a child of the main category
          if (!subInfo?.parent || subInfo.parent === category) {
            subCategory = subHeading.text;
          }
        }
      }

      // Fallback: if we found a heading but it's not in our map, use it anyway
      if (!category && headingStack.length > 0) {
        category = headingStack[0].text;
      }

      // CRITICAL: If no category found, use "misc" to ensure no files go to root
      if (!category) {
        category = 'misc';
      }

      return { category: category.trim(), subCategory: subCategory?.trim() };
    };

    // Helper function to clean text (remove emojis, images, etc.)
    const cleanText = (text: string): string => {
      return text
        // Remove emojis (Unicode ranges for common emojis)
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
        .replace(/[\u{2600}-\u{26FF}]/gu, '') // Misc symbols
        .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // Variation Selectors
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
        .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
        .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
        // Remove image-related text patterns
        .replace(/\[.*?\]/g, '') // Remove text in brackets (often image references)
        .replace(/Image:/gi, '')
        .replace(/File:/gi, '')
        .replace(/thumb\|/gi, '')
        // Remove HTML entities
        .replace(/&[a-z]+;/gi, '')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Helper function to check if text looks like a voice line (not an image reference)
    const isValidVoiceLine = (text: string): boolean => {
      if (!text || text.length < 2) return false;
      
      const lowerText = text.toLowerCase();
      
      // Exclude image-related patterns
      const imagePatterns = [
        /^image/i,
        /^file:/i,
        /\.png/i,
        /\.jpg/i,
        /\.jpeg/i,
        /\.gif/i,
        /\.svg/i,
        /thumb/i,
        /^\[.*\]$/,
      ];
      
      for (const pattern of imagePatterns) {
        if (pattern.test(text)) return false;
      }
      
      // Must contain at least one letter (not just numbers/symbols)
      if (!/[a-zA-Z]/.test(text)) return false;
      
      return true;
    };

    // Helper function to extract text beside play button (excluding images)
    const extractVoiceLineText = ($link: cheerio.Cheerio): string | undefined => {
      // Clone the link's context to remove images before extracting text
      const $linkClone = $link.clone();
      $linkClone.find('img').remove();
      
      // Method 1: Text in the same list item or div (excluding images)
      const $parent = $link.parent();
      if ($parent.length) {
        // Clone parent and remove images
        const $parentClone = $parent.clone();
        $parentClone.find('img').remove();
        
        const parentText = $parentClone.text().trim();
        const linkText = $linkClone.text().trim();
        
        if (parentText && parentText !== linkText) {
          // Remove common prefixes/suffixes
          let text = parentText.replace(linkText, '').trim();
          text = text.replace(/^[•\-\*]\s*/, '').trim();
          text = cleanText(text);
          
          if (isValidVoiceLine(text) && text.length < 200) {
            return text;
          }
        }
      }

      // Method 2: Next sibling text (excluding images)
      const $nextSibling = $link.next();
      if ($nextSibling.length && !$nextSibling.is('img')) {
        const $siblingClone = $nextSibling.clone();
        $siblingClone.find('img').remove();
        const nextText = $siblingClone.text().trim();
        const cleaned = cleanText(nextText);
        
        if (isValidVoiceLine(cleaned) && cleaned.length < 200) {
          return cleaned;
        }
      }

      // Method 3: Text in list item (li) excluding images
      const $listItem = $link.closest('li');
      if ($listItem.length) {
        const $listItemClone = $listItem.clone();
        $listItemClone.find('img').remove();
        
        const listText = $listItemClone.text().trim();
        const linkText = $linkClone.text().trim();
        
        if (listText && listText !== linkText) {
          let text = listText.replace(linkText, '').trim();
          text = text.replace(/^[•\-\*]\s*/, '').trim();
          text = cleanText(text);
          
          if (isValidVoiceLine(text) && text.length < 200) {
            return text;
          }
        }
      }

      // Method 4: Text in table cell (excluding images)
      const $row = $link.closest('tr');
      if ($row.length) {
        const cells = $row.find('td');
        for (let i = 0; i < cells.length; i++) {
          const $cell = $(cells[i]);
          
          // Skip cells with images
          if ($cell.find('img').length > 0) continue;
          
          const $cellClone = $cell.clone();
          $cellClone.find('img').remove();
          const cellText = $cellClone.text().trim();
          const cleaned = cleanText(cellText);
          
          // Skip if it's just the link or invalid
          if (isValidVoiceLine(cleaned) && cleaned.length > 3 && cleaned.length < 200) {
            // Check if this cell contains the link
            if ($cell.find($link).length === 0 || cleaned !== $linkClone.text().trim()) {
              return cleaned;
            }
          }
        }
      }

      return undefined;
    };

    // Helper function to extract context for an audio link
    const extractAudioLinkInfo = (
      $link: cheerio.Cheerio,
      url: string
    ): AudioLinkInfo => {
      // Find section category
      const { category, subCategory } = findSectionCategory($link);
      
      // Extract voice line text (text beside play button)
      const voiceLineText = extractVoiceLineText($link);
      
      // Fallback to link text
      let linkText = $link.text().trim();
      if (!linkText || linkText.length < 2) {
        linkText = voiceLineText || '';
      }

      return {
        url,
        linkText: linkText || undefined,
        responseType: category?.toLowerCase(),
        category,
        subCategory,
        voiceLineText: voiceLineText || undefined,
      };
    };

    // Method 1: Find direct links to audio files (best for extracting link text)
    $('a[href$=".ogg"], a[href$=".mp3"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        
        if (!audioLinksInfo.has(fullUrl)) {
          const info = extractAudioLinkInfo($link, fullUrl);
          audioLinksInfo.set(fullUrl, info);
        }
      }
    });

    // Method 2: Find <audio> tags with src attribute
    $('audio source').each((_, element) => {
      const src = $(element).attr('src');
      if (src && (src.endsWith('.ogg') || src.endsWith('.mp3'))) {
        const fullUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
        
        if (!audioLinksInfo.has(fullUrl)) {
          const $audio = $(element).closest('audio');
          const info = extractAudioLinkInfo($audio, fullUrl);
          audioLinksInfo.set(fullUrl, info);
        }
      }
    });

    // Method 3: Find links in response sections
    $('.mw-parser-output a[href*=".ogg"], .mw-parser-output a[href*=".mp3"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      if (href && (href.includes('.ogg') || href.includes('.mp3'))) {
        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        
        if (!audioLinksInfo.has(fullUrl)) {
          const info = extractAudioLinkInfo($link, fullUrl);
          audioLinksInfo.set(fullUrl, info);
        }
      }
    });

    const totalLinks = audioLinksInfo.size;
    console.log(`  📦 Found ${totalLinks} audio links`);

    if (totalLinks === 0) {
      return {
        hero: heroPage.heroName,
        url: heroPage.url,
        voiceLines: [],
        categories: {},
        totalFiles: 0,
        scrapedAt: new Date().toISOString(),
      };
    }

    // Build voice lines array with links, names, and categories
    const voiceLines: VoiceLineEntry[] = [];
    const categoryMap: Record<string, { subCategories?: string[]; count: number }> = {};

    let processedCount = 0;
    for (const [url, linkInfo] of audioLinksInfo) {
      processedCount++;
      const progress = `[${processedCount}/${totalLinks}]`;
      
      // Get the voice line name (text beside play button) and clean it
      let name = linkInfo.voiceLineText || linkInfo.linkText || 'Unknown';
      
      // Clean the name: remove emojis, play buttons, images, and invalid patterns
      name = name
        // Remove play button characters (▶, ►, ▸, ▶️, etc.)
        .replace(/[▶►▸▹▻◀◁◂◃◄]/g, '')
        .replace(/▶️/g, '')
        // Remove emojis
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
        .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
        .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
        // Remove image references
        .replace(/\[.*?\]/g, '')
        .replace(/Image:/gi, '')
        .replace(/File:/gi, '')
        .replace(/thumb\|/gi, '')
        .replace(/\.png|\.jpg|\.jpeg|\.gif|\.svg/gi, '')
        // Remove HTML entities
        .replace(/&[a-z]+;/gi, '')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
      
      // Skip if name is invalid after cleaning
      if (!name || name.length < 2 || !/[a-zA-Z]/.test(name)) {
        name = 'Unknown';
      }
      
      const category = linkInfo.category || 'misc';
      const subCategory = linkInfo.subCategory;
      
      // Show progress
      const shortName = name.length > 30 ? name.substring(0, 27) + '...' : name;
      process.stdout.write(`  ${progress} 📝 Processing ${shortName}... `);
      
      // Add to voice lines
      voiceLines.push({
        name: name,
        link: url,
        category: category.trim(),
        subCategory: subCategory?.trim(),
      });

      // Update category map
      if (!categoryMap[category]) {
        categoryMap[category] = { count: 0 };
      }
      categoryMap[category].count++;
      
      if (subCategory) {
        if (!categoryMap[category].subCategories) {
          categoryMap[category].subCategories = [];
        }
        if (!categoryMap[category].subCategories!.includes(subCategory)) {
          categoryMap[category].subCategories!.push(subCategory);
        }
      }

      console.log(`✅`);
    }

    // Return hero data (will be saved in a single file at the end)
    const heroData: HeroVoiceLines = {
      hero: heroPage.heroName,
      url: heroPage.url,
      voiceLines,
      categories: categoryMap,
      totalFiles: voiceLines.length,
      scrapedAt: new Date().toISOString(),
    };

    // Show summary for this hero
    console.log(`  📊 Summary for ${heroPage.heroName}:`);
    console.log(`     📝 Processed: ${voiceLines.length} voice lines`);
    console.log(`     📂 Categories: ${Object.keys(categoryMap).length}`);

    return heroData;
  } catch (error: any) {
    console.error(`  ❌ Failed to scrape ${heroPage.heroName}: ${error.message}`);
    return {
      hero: heroPage.heroName,
      url: heroPage.url,
      voiceLines: [],
      categories: {},
      totalFiles: 0,
      scrapedAt: new Date().toISOString(),
    };
  }
}

// Main scraping function
async function main() {
  console.log('🚀 Starting Dota 2 Voice Line Scraper...\n');

  const startTime = Date.now();
  let totalDownloaded = 0;
  let totalErrors = 0;

  try {
    // Ensure voice-lines directory exists
    const voiceLinesDir = getVoiceLinesDir();
    await fs.ensureDir(voiceLinesDir);
    console.log(`📁 Output directory: ${voiceLinesDir}\n`);

    // Get all hero pages
    const heroPages = await getHeroPages();
    console.log('');

    // Scrape each hero page and collect data
    const allHeroesData: HeroVoiceLines[] = [];
    
    for (let i = 0; i < heroPages.length; i++) {
      const heroPage = heroPages[i];
      const heroProgress = `[${i + 1}/${heroPages.length}]`;
      console.log(`\n${heroProgress} 🎭 Scraping ${heroPage.heroName}...`);
      console.log(`  🔗 Source: ${heroPage.url}`);
      console.log(`${'─'.repeat(60)}`);

      try {
        const heroData = await scrapeHeroPage(heroPage, i, heroPages.length);
        allHeroesData.push(heroData);
        totalDownloaded += heroData.totalFiles;
      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`);
        totalErrors++;
      }

      // Small delay between heroes to avoid overwhelming the server
      if (i < heroPages.length - 1) {
        await delay(500);
      }
    }

    // Save all heroes data to a single JSON file
    if (allHeroesData.length > 0) {
      const allData: AllHeroesVoiceLines = {
        heroes: allHeroesData,
        totalHeroes: allHeroesData.length,
        totalVoiceLines: totalDownloaded,
        scrapedAt: new Date().toISOString(),
      };

      const jsonPath = path.join(voiceLinesDir, 'voice-lines.json');
      await fs.writeJson(jsonPath, allData, { spaces: 2 });
      
      console.log(`\n💾 All data saved to: ${jsonPath}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const minutes = Math.floor(parseFloat(duration) / 60);
    const seconds = (parseFloat(duration) % 60).toFixed(0);
    const durationStr = minutes > 0 
      ? `${minutes}m ${seconds}s` 
      : `${duration}s`;
    console.log('\n' + '='.repeat(60));
    console.log('✨ Scraping completed!');
    console.log('='.repeat(60));
    console.log(`📊 Final Stats:`);
    console.log(`   🎭 Heroes scraped: ${heroPages.length}`);
    console.log(`   📝 Total voice lines: ${totalDownloaded}`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log(`   ⏱️  Duration: ${durationStr}`);
    console.log(`📁 JSON file saved to: ${voiceLinesDir}/voice-lines.json`);
    console.log('='.repeat(60));
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the scraper
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

