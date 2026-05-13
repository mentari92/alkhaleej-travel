import { GoogleGenAI } from "@google/genai";
import { ArticleParams, GeneratedContent, SearchIntent } from "../types";

const apiKey = process.env.API_KEY;

const ai = new GoogleGenAI({ apiKey: apiKey });

// --- 1. VISUAL THEMES (SKIN)---
const VISUAL_THEMES: Record<string, any> = {
  'AsriStyle': {
    primary: '#0f172a', accent: '#0ea5e9', bg_box: '#f0f9ff', border: '#bae6fd',
    font_head: 'ui-sans-serif, system-ui, sans-serif', font_body: 'ui-sans-serif, system-ui, sans-serif'
  },
  'Warm': {
    primary: '#78350f', accent: '#d97706', bg_box: '#fffbeb', border: '#fcd34d',
    font_head: 'Georgia, serif', font_body: 'Georgia, serif'
  },
  'Corporate': {
    primary: '#1e3a8a', accent: '#2563eb', bg_box: '#eff6ff', border: '#bfdbfe',
    font_head: 'Arial, sans-serif', font_body: 'Arial, sans-serif'
  },
  'Vibrant': {
    primary: '#be123c', accent: '#f43f5e', bg_box: '#fff1f2', border: '#fecdd3',
    font_head: 'Verdana, sans-serif', font_body: 'Verdana, sans-serif'
  },
  'Minimalist': {
    primary: '#18181b', accent: '#52525b', bg_box: '#fafafa', border: '#e4e4e7',
    font_head: 'Courier New, monospace', font_body: 'Helvetica, sans-serif'
  }
};

// --- 2. IMAGE GENERATOR ---
const generateImageFromPrompt = async (prompt: string): Promise<string | null> => {
  try {
    // KITA PERTAHANKAN "Instruksi Bagus" iPhone 16 Pro ini
    const enhancedPrompt = `
      captured with iPhone 16 Pro, candid photography, natural lighting, imperfect realistic texture, no studio setup, 
      photorealistic 8k, detailed skin texture, cinematic color grading,
      ${prompt}
    `;
    
    // Upgrade ke model Gemini 3 Preview untuk image
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', 
      contents: { parts: [{ text: enhancedPrompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) return part.inlineData.data; 
      }
    }
    return null;
  } catch (error) {
    console.error("Visual Core Error:", error);
    return null; 
  }
};

export const generateProductMetadata = async (productTitle: string): Promise<{ description: string; cta_label: string }> => {
  if (!apiKey) throw new Error("API Key missing");
  const prompt = `Analisa judul produk: "${productTitle}". Buat JSON: {"description": "15 kata persuasif", "cta_label": "2 kata CTA nendang"}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    return { description: "Produk rekomendasi terbaik.", cta_label: "CEK DETAIL" };
  }
};

// --- 3. MAIN BLOG GENERATION ---
export const generateBlogContent = async (params: ArticleParams): Promise<GeneratedContent> => {
  if (!apiKey) throw new Error("API Key is missing.");

  const { 
    topic, location, tone, keyword, visualStyle, 
    textColor, productWidgetHtml,
    language, wordCount, imageCount, internalLinks,
    searchIntent, targetAudience 
  } = params;
  
  // Theme Setup
  const theme = VISUAL_THEMES[visualStyle] || VISUAL_THEMES['AsriStyle'];

  // Dynamic CSS 
  const dynamicCss = `
    body { color: ${textColor}; font-family: ${theme.font_body}; line-height: 1.8; font-size: 16px; max-width: 100%; }
    h1, h2, h3, h4 { color: ${theme.primary}; font-family: ${theme.font_head}; font-weight: 800; line-height: 1.3; margin-top: 1.5em; }
    h1 { font-size: 2.2em; text-align: center; margin: 1em 0; }
    h2 { font-size: 1.6em; border-bottom: 2px solid ${theme.border}; padding-bottom: 10px; }
    a { color: ${theme.accent}; text-decoration: none; border-bottom: 1px dotted ${theme.accent}; }
    
    /* SEO META BOX (NEW V2) */
    .seo-meta-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin-bottom: 30px; font-family: monospace; font-size: 0.85em; color: #334155; }
    
    /* LEGACY COMPONENTS (KEPT) */
    .summary-box { background-color: ${theme.bg_box}; border: 1px solid ${theme.border}; border-left: 5px solid ${theme.accent}; padding: 20px; margin: 30px 0; border-radius: 8px; }
    .pros-cons { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
    .pros-cons .pros { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; }
    .pros-cons .cons { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; }
    @media (max-width: 600px) { .pros-cons { grid-template-columns: 1fr; } }
  `;

  // --- ETHNICITY MAPPING ---
  let ethnicityKeyword = "DIVERSE / GENERAL";
  if (language === 'id') ethnicityKeyword = "INDONESIAN / SOUTHEAST ASIAN (Malay Look)";
  if (language === 'my') ethnicityKeyword = "MALAY / SOUTHEAST ASIAN (Malay Look)";
  if (language === 'cn') ethnicityKeyword = "CHINESE (East Asian Look)";
  if (language === 'jp') ethnicityKeyword = "JAPANESE (East Asian Look)";
  if (language === 'kr') ethnicityKeyword = "KOREAN (East Asian Look)";
  if (language === 'ar') ethnicityKeyword = "ARAB / MIDDLE EASTERN";
  if (language === 'en') ethnicityKeyword = "WESTERN / DIVERSE";

  // Widget Logic
  const widgetInstruction = (productWidgetHtml && productWidgetHtml.length > 50) 
    ? `INSERT_WIDGET: Place "[[PRODUCT_WIDGET_HERE]]" naturally after the first major section.` 
    : "";

  // --- PROTOCOL X: VISUAL RULES ---
  const imageInstruction = imageCount > 0 
    ? `
      VISUALS: Include exactly ${imageCount} [[IMAGE_PROMPT: description]] placeholders.
      PROTOCOL X - CONTENT SANITIZATION & PERSONA RULES:
      1. FORBIDDEN: Pork, Alcohol, Gambling, Sexy/Revealing clothes.
      2. SANITIZATION:
         - PORK -> Beef/Chicken/Abstract.
         - ALCOHOL -> Juice/Coffee/Bokeh.
         - SEXY WOMAN -> Override with "MODEST CASUAL ATTIRE" (Long sleeves, loose fitting, high neck, polite).
      3. ETHNICITY: All human subjects MUST LOOK: **${ethnicityKeyword}**.
      4. RELIGIOUS HIERARCHY:
         - Context ISLAMIC/HALAL -> Default to Hijab/Syari.
         - Context GENERAL -> ('id'/'my' -> Modest Hijab/Syari) | ('jp'/'kr'/'en'/'cn' -> Modest Casual NO Hijab) | ('ar' -> Hijab/Abaya).
    `
    : `VISUALS: Do NOT include any [[IMAGE_PROMPT]] placeholders.`;

  const linkInstruction = internalLinks ? `INTERNAL LINKS: Naturally link to these URLS/Topics: ${internalLinks}` : "";
  const widgetInstruction = (productWidgetHtml && productWidgetHtml.length > 50) ? `Insert "[[PRODUCT_WIDGET_HERE]]" naturally after the first major section.` : "";

  // --- THE CORE PROMPT ---
  const prompt = `
    Role: Senior SEO Content Strategist & Copywriter.
    Task: Write a high-quality, high-ranking blog post HTML body.
    
    INPUT CONTEXT:
    - Core Idea: "${topic}"
    - Keyword: "${keyword}"
    - Tone: ${tone}
    
    ${languageInstruction}
    ${imageInstruction}
    ${linkInstruction}
    ${widgetInstruction}

    ${structureRules}

    CRITICAL HUMANIZATION PROTOCOL (APPLY TO TITLE AND ALL CONTENT):
    
    1. **NO ROBOTIC COMPOUND WORDS (HYPHENS)**:
       - **FORBIDDEN PATTERNS**: "Anti-Lecet", "Super-Cepat", "Ultra-Ringan".
       - **REQUIRED ACTION**: Unwrap these into natural flow (e.g., "Gak Bikin Lecet", "Cepet Banget").
    
    2. **NATURAL CONVERSATIONAL FLOW (If Language is ID/MY)**:
       - Use conversational particles: "lho", "kok", "nih", "tuh", "banget", "pas", "buat".
       - Avoid rigid passive voice. Write like a human expert talking to a beginner.

    3. **TITLE RULES**:
       - Create a NEW, CATCHY Title with Numbers.
       - NEVER use a Colon (:).
       - NEVER use robotic hyphens in the title.
    
    4. **TEXT FORMATTING**:
       - Keep paragraphs short (max 3 sentences).
       - Use Bold for emphasis on key benefits.

    CRITICAL STYLING INSTRUCTION:
    1. Output ONLY HTML.
    2. **NO MARKDOWN ARTIFACTS**: Do not output asterisks (**), hash signs (#), or backticks. Use proper HTML tags (<strong>, <h2>) instead.
    3. Inject the CSS below into a <style> tag at the top.
    4. Use the correct classes: <div class="summary-box">, <div class="pros-cons"><div class="pros">...</div><div class="cons">...</div></div>.

  // --- INTENT FRAMEWORK ---
  const getIntentRules = (intent: SearchIntent) => {
    switch (intent) {
      case 'Informational': return "Structure: How-to, definitions, guides. Focus on answering 'What', 'How', 'Why'.";
      case 'Commercial': return "Structure: Comparisons, pros/cons tables, Best X for Y lists. Focus on features and evaluation.";
      case 'Transactional': return "Structure: Clear CTAs, urgency, buying guides, discounts. Focus on conversion.";
      case 'Mixed': return "Structure: Educational intro -> Problem Agitation -> Solution (Product).";
      default: return "Structure: Comprehensive Guide.";
    }
  };

  // --- THE MERGED PROMPT ---
  const prompt = `
    Role: Expert SEO Content Strategist & Copywriter.
    Task: Write a High-Ranking SEO Article (Merged JagoSEO V1 + V2 Blueprint).
    
    --- USER INPUT ---
    Topic: "${topic}"
    Target Audience: "${targetAudience || 'General'}"
    Primary Keyword: "${keyword}"
    Search Intent: ${searchIntent}
    Desired Tone: ${tone}
    Language: ${language} (Write entirely in this language)
    Context Location: ${location}
    Length: ${wordCount} words
    Internal Links Context: ${internalLinks || 'None'}

    --- INTENT FRAMEWORK (V2) ---
    ${getIntentRules(searchIntent)}

    --- HUMANIZATION PROTOCOL (LEGACY - STRICT) ---
    1. **NO ROBOTIC COMPOUND WORDS**: "Anti-Lecet" -> "Gak Bikin Lecet", "Super-Cepat" -> "Cepet Banget".
    2. **CONVERSATIONAL FLOW**: Use particles (lho, kok, nih) if language is ID/MY.
    3. **READABILITY**: Grade 6-9. Short paragraphs (2-3 sentences).

    --- SEO & STRUCTURE RULES ---
    1. **Structure**: Title -> Intro (Hook) -> H2 Blocks -> H3 Details -> FAQ -> Conclusion.
    2. **Schema**: Include JSON-LD for "Article".
    3. **Meta**: Provide a box with Title Tag, Meta Desc, and Slug.
    4. **EEAT**: Demonstrate expertise.

    --- OUTPUT FORMAT (HTML) ---
    Output ONLY valid HTML code.
    
    <style>${dynamicCss}</style>
    
    <!-- SEO METADATA BOX (V2 Feature) -->
    <div class="seo-meta-box">
      <p><strong>Title Tag:</strong> [Max 60 chars, catchy, includes keyword]</p>
      <p><strong>Meta Description:</strong> [Max 160 chars, CTR focused]</p>
      <p><strong>Slug:</strong> [URL-friendly-slug]</p>
    </div>

    <!-- SCHEMA MARKUP (V2 Feature) -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "[Title Tag]",
      "description": "[Meta Description]",
      "author": {"@type": "Person", "name": "Admin"},
      "keywords": "${keyword}",
      "datePublished": "${new Date().toISOString().split('T')[0]}"
    }
    </script>

    <!-- CONTENT BODY (Legacy + V2 Mixed) -->
    <article>
      <h1>[H1 Heading - Catchy & SEO Optimized]</h1>
      
      <div class="summary-box">
        <strong>TL;DR:</strong> [50 word summary of the solution]
      </div>

      [Introduction Hook matching Intent]
      
      ${widgetInstruction}

      [H2 Sections with H3 subsections]
      [If Commercial/Mixed, use <div class="pros-cons"><div class="pros">...</div><div class="cons">...</div></div>]

      [FAQ Section - 3 Common Questions]

      [Conclusion & CTA]
    </article>

    ${imageInstruction}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: prompt,
      config: { temperature: 0.85 }
    });

    const fullText = response.text || "";
    let htmlContent = fullText.replace(/```html|```/g, '').trim();

    // Widget Injection
    if (widgetInstruction && productWidgetHtml.length > 50) {
      if (htmlContent.includes('[[PRODUCT_WIDGET_HERE]]')) {
        htmlContent = htmlContent.replace('[[PRODUCT_WIDGET_HERE]]', productWidgetHtml);
      } else {
        const firstH2 = htmlContent.indexOf('</h2>');
        if (firstH2 !== -1) {
          htmlContent = htmlContent.slice(0, firstH2 + 5) + productWidgetHtml + htmlContent.slice(firstH2 + 5);
        }
      }
    }

    // Image Processing
    if (imageCount > 0) {
      const matches = [...htmlContent.matchAll(/\[\[IMAGE_PROMPT: (.*?)\]\]/g)].slice(0, imageCount);
      const generatedImages = await Promise.all(matches.map(async (match) => {
        return { 
          placeholder: match[0], 
          data: await generateImageFromPrompt(match[1]) 
        };
      }));

      generatedImages.forEach(img => {
        if (img.data) {
          const imgHtml = `
            <figure style="margin: 2em 0;">
              <img src="data:image/png;base64,${img.data}" alt="${params.keyword}" style="width:100%; height:auto; border-radius:8px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);" />
              <figcaption style="text-align:center; font-size:0.8em; color:#64748b; margin-top:0.5em;">${params.keyword}</figcaption>
            </figure>
          `;
          htmlContent = htmlContent.replace(img.placeholder, imgHtml);
        } else {
          htmlContent = htmlContent.replace(img.placeholder, '');
        }
      });
      htmlContent = htmlContent.replace(/\[\[IMAGE_PROMPT: .*?\]\]/g, '');
    }

    return { htmlBody: htmlContent };

  } catch (error) {
    console.error("JagoSEO Engine Error:", error);
    throw error;
  }
};