export interface Product {
  id: string;
  asin: string;
  name: string;
  category: string;
  price: string;
  features: string[];
  description: string;
  imageUrls: string[];
  customerFeedbackThemes: string;
  targetAudience: string;
  seoKeywords: string;
  createdAt: string;
}

export interface ContentPackage {
  id: string;
  product_id: string;
  product_name: string;
  status: 'draft' | 'review' | 'approved' | 'rejected';
  compliance_pass: boolean;
  content: {
    product_overview: string;
    key_features: string[];
    customer_feedback_summary: string;
    who_it_is_for: string;
    pros_and_cons: { pros: string[]; cons: string[] };
    product_page_copy: string;
    faq: { question: string; answer: string }[];
    pinterest_assets: { headline: string; description: string }[];
    short_form_video_assets: { script: string; hook: string };
    social_captions: string[];
    seo_title_meta: { title: string; meta_description: string };
    disclosure_block: string;
    compliance_checklist: { item: string; pass: boolean }[];
    approval_request: string;
  };
  compliance_checks: Record<string, boolean>;
  created_at: string;
  reviewed_at: string | null;
  revision_feedback: string | null;
}
