export interface ProductItem {
  id: string;
  url: string;
  title: string;
  price: string;
  image: string;
  rating: number;
  description?: string;
  cta_label?: string;
}

// Update sesuai "Ultimate SEO Prompt V2"
export type SearchIntent = 'Informational' | 'Commercial' | 'Transactional' | 'Mixed';

export type ToneStyle = 
  | 'Neutral, Clear, Professional'
  | 'Friendly & Conversational'
  | 'Expert Authority'
  | 'Persuasive Marketing Copy'
  | 'Storytelling'
  | 'Technical & Academic'
  | 'Short, punchy, Gen-Z';

export interface ArticleParams {
  // Core Inputs
  topic: string;
  keyword: string;
  
  // New Fields (Prompt V2)
  targetAudience: string; 
  searchIntent: SearchIntent;
  
  // Style & Tone
  tone: ToneStyle; 
  language: string;
  
  // Visual & Formatting
  location: string;
  visualStyle: string;
  textColor: string;
  backgroundColor: string;
  
  // Constraints
  wordCount: number;
  imageCount: number;
  internalLinks: string;
  
  // Widget
  productWidgetHtml: string;
  productWidgetItems: ProductItem[];
  
  // Legacy props (kept optional to prevent breaking if passed)
  style?: string; 
}

export interface GeneratedContent {
  htmlBody: string;
}

export interface ToastMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

export enum GenerationStatus {
  IDLE = 'idle',
  GENERATING = 'generating',
  SUCCESS = 'success',
  ERROR = 'error'
}