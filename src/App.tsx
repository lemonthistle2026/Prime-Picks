import React, { useState, useEffect } from 'react';
import { Layout, List, FileText, PlusCircle, CheckCircle2, XCircle, AlertCircle, ChevronLeft, Save, Send } from 'lucide-react';
import { Product, ContentPackage } from './types';

type View = 'dashboard' | 'review' | 'input';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [packages, setPackages] = useState<ContentPackage[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pkgsRes, prodsRes] = await Promise.all([
        fetch('/api/packages'),
        fetch('/api/products')
      ]);
      const pkgs = await pkgsRes.json();
      const prods = await prodsRes.json();
      setPackages(pkgs);
      setProducts(prods);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    await fetch(`/api/packages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' })
    });
    fetchData();
    setCurrentView('dashboard');
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/packages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' })
    });
    fetchData();
    setCurrentView('dashboard');
  };

  const handleRequestRevision = async (id: string, feedback: string) => {
    await fetch(`/api/packages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'review', revision_feedback: feedback })
    });
    fetchData();
    setCurrentView('dashboard');
  };

  const handleAddProduct = async (product: Partial<Product>) => {
    setLoading(true);
    try {
      await fetch('/api/products/with-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      await fetchData();
      setCurrentView('dashboard');
    } catch (err) {
      console.error('Error adding product:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPackages = statusFilter === 'all' 
    ? packages 
    : packages.filter(p => p.status === statusFilter);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
          <Layout className="w-6 h-6 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">AffiliateContent Engine</h1>
        </div>
        <nav className="flex gap-4">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setCurrentView('input')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${currentView === 'input' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <PlusCircle className="w-4 h-4" />
            New Product
          </button>
        </nav>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="text-gray-500 font-medium">Triggering content generation...</p>
          </div>
        ) : (
          <>
            {currentView === 'dashboard' && (
              <Dashboard 
                packages={filteredPackages} 
                onSelect={(id) => {
                  setSelectedPackageId(id);
                  setCurrentView('review');
                }}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
              />
            )}
            {currentView === 'review' && selectedPackageId && (
              <ReviewView 
                pkg={packages.find(p => p.id === selectedPackageId)!}
                onBack={() => setCurrentView('dashboard')}
                onApprove={handleApprove}
                onReject={handleReject}
                onRevision={handleRequestRevision}
              />
            )}
            {currentView === 'input' && (
              <ProductInput 
                onSubmit={handleAddProduct}
                onCancel={() => setCurrentView('dashboard')}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

// --- Dashboard Component ---
const Dashboard: React.FC<{
  packages: ContentPackage[];
  onSelect: (id: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
}> = ({ packages, onSelect, statusFilter, setStatusFilter }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Packages</h2>
          <p className="text-gray-500">Manage and review generated affiliate content</p>
        </div>
        <div className="flex gap-2">
          {['all', 'draft', 'review', 'approved', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                statusFilter === status 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {packages.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No packages found</h3>
          <p className="text-gray-500">Wait for Content Generator to produce packages or check your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map(pkg => (
            <div 
              key={pkg.id} 
              onClick={() => onSelect(pkg.id)}
              className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden group"
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    pkg.status === 'approved' ? 'bg-green-50 text-green-700' :
                    pkg.status === 'rejected' ? 'bg-red-50 text-red-700' :
                    pkg.status === 'review' ? 'bg-amber-50 text-amber-700' :
                    'bg-gray-50 text-gray-700'
                  }`}>
                    {pkg.status}
                  </span>
                  {pkg.compliance_pass ? (
                    <div className="flex items-center text-green-600 gap-1 text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Compliant</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600 gap-1 text-xs">
                      <AlertCircle className="w-4 h-4" />
                      <span>Issues</span>
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{pkg.product_name}</h3>
                <p className="text-xs text-gray-500 mt-1">ID: {pkg.id} • Created: {new Date(pkg.created_at).toLocaleDateString()}</p>
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">Review content</span>
                <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Review View Component ---
const ReviewView: React.FC<{
  pkg: ContentPackage;
  onBack: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRevision: (id: string, feedback: string) => void;
}> = ({ pkg, onBack, onApprove, onReject, onRevision }) => {
  const [feedback, setFeedback] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  const sections = [
    { title: '1. PRODUCT OVERVIEW', content: pkg.content.product_overview },
    { title: '2. KEY FEATURES', content: pkg.content.key_features, type: 'list' },
    { title: '3. CUSTOMER FEEDBACK SUMMARY', content: pkg.content.customer_feedback_summary },
    { title: '4. WHO IT IS FOR', content: pkg.content.who_it_is_for },
    { title: '5. PROS AND CONS', content: pkg.content.pros_and_cons, type: 'pros_cons' },
    { title: '6. PRODUCT PAGE COPY', content: pkg.content.product_page_copy, type: 'pre' },
    { title: '7. FAQ', content: pkg.content.faq, type: 'faq' },
    { title: '8. PINTEREST ASSETS', content: pkg.content.pinterest_assets, type: 'pinterest' },
    { title: '9. SHORT-FORM VIDEO ASSETS', content: pkg.content.short_form_video_assets, type: 'video' },
    { title: '10. SOCIAL CAPTIONS', content: pkg.content.social_captions, type: 'list' },
    { title: '11. SEO TITLE + META DESCRIPTION', content: pkg.content.seo_title_meta, type: 'seo' },
    { title: '12. DISCLOSURE BLOCK', content: pkg.content.disclosure_block, type: 'italic' },
    { title: '13. COMPLIANCE CHECKLIST', content: pkg.content.compliance_checklist, type: 'checklist' },
    { title: '14. APPROVAL REQUEST', content: pkg.content.approval_request },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <button 
        onClick={onBack}
        className="flex items-center gap-1 text-gray-600 hover:text-indigo-600 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{pkg.product_name}</h2>
            <p className="text-gray-500">Package Review: {pkg.id}</p>
          </div>
          <div className="flex items-center gap-3">
             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                pkg.status === 'approved' ? 'bg-green-50 text-green-700' :
                pkg.status === 'rejected' ? 'bg-red-50 text-red-700' :
                'bg-amber-50 text-amber-700'
              }`}>
                {pkg.status}
              </span>
          </div>
        </div>

        <div className="p-8 space-y-10">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className="text-sm font-black text-gray-400 tracking-widest uppercase border-b border-gray-100 pb-2">{section.title}</h3>
              <div className="text-gray-800 leading-relaxed">
                {section.type === 'list' && (
                  <ul className="list-disc pl-5 space-y-1">
                    {(section.content as string[]).map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                )}
                {section.type === 'pros_cons' && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <h4 className="text-xs font-bold text-green-700 uppercase mb-2">Pros</h4>
                      <ul className="list-disc pl-4 text-sm text-green-800 space-y-1">
                        {(section.content as any).pros.map((item: string, i: number) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                      <h4 className="text-xs font-bold text-red-700 uppercase mb-2">Cons</h4>
                      <ul className="list-disc pl-4 text-sm text-red-800 space-y-1">
                        {(section.content as any).cons.map((item: string, i: number) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
                {section.type === 'pre' && (
                  <pre className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm whitespace-pre-wrap font-sans">
                    {section.content as string}
                  </pre>
                )}
                {section.type === 'italic' && <p className="italic text-gray-500">{section.content as string}</p>}
                {section.type === 'faq' && (
                  <div className="space-y-4">
                    {(section.content as any[]).map((faq, i) => (
                      <div key={i} className="space-y-1">
                        <p className="font-bold">Q: {faq.question}</p>
                        <p className="text-gray-600">A: {faq.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
                {section.type === 'pinterest' && (
                  <div className="grid grid-cols-1 gap-4">
                    {(section.content as any[]).map((asset, i) => (
                      <div key={i} className="p-4 border border-gray-200 rounded-lg">
                        <p className="font-bold text-indigo-600 mb-1">{asset.headline}</p>
                        <p className="text-sm text-gray-600">{asset.description}</p>
                      </div>
                    ))}
                  </div>
                )}
                {section.type === 'video' && (
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-700 uppercase mb-2">Hook: {(section.content as any).hook}</p>
                    <p className="text-sm text-indigo-900 whitespace-pre-wrap italic">{(section.content as any).script}</p>
                  </div>
                )}
                {section.type === 'seo' && (
                  <div className="space-y-2">
                    <p><span className="text-xs font-bold text-gray-400 uppercase mr-2">Title:</span> {(section.content as any).title}</p>
                    <p><span className="text-xs font-bold text-gray-400 uppercase mr-2">Meta:</span> {(section.content as any).meta_description}</p>
                  </div>
                )}
                {section.type === 'checklist' && (
                  <div className="space-y-2">
                    {(section.content as any[]).map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {item.pass ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                        <span className={item.pass ? 'text-gray-700' : 'text-red-700 font-medium'}>{item.item}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!section.type && <p>{section.content as string}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="px-8 py-10 bg-gray-50 border-t border-gray-200">
          {!showRevisionForm ? (
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => onApprove(pkg.id)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-lg shadow-green-100"
              >
                <CheckCircle2 className="w-5 h-5" />
                Approve Package
              </button>
              <button 
                onClick={() => setShowRevisionForm(true)}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-lg shadow-amber-100"
              >
                <AlertCircle className="w-5 h-5" />
                Request Revision
              </button>
              <button 
                onClick={() => onReject(pkg.id)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-lg shadow-red-100"
              >
                <XCircle className="w-5 h-5" />
                Reject
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-w-2xl mx-auto">
              <h3 className="font-bold text-gray-900">Revision Feedback</h3>
              <textarea 
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px]"
                placeholder="Describe what needs to be changed..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setShowRevisionForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => onRevision(pkg.id, feedback)}
                  disabled={!feedback.trim()}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Submit Request
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Product Input Component ---
const ProductInput: React.FC<{
  onSubmit: (p: Partial<Product>) => void;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    asin: '',
    name: '',
    category: '',
    price: '',
    features: [],
    description: '',
    imageUrls: [],
    customerFeedbackThemes: '',
    targetAudience: '',
    seoKeywords: '',
  });

  const [featureInput, setFeatureInput] = useState('');
  const [imageInput, setImageInput] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddFeature = () => {
    if (featureInput.trim()) {
      setFormData(prev => ({ ...prev, features: [...(prev.features || []), featureInput.trim()] }));
      setFeatureInput('');
    }
  };

  const handleAddImage = () => {
    if (imageInput.trim()) {
      setFormData(prev => ({ ...prev, imageUrls: [...(prev.imageUrls || []), imageInput.trim()] }));
      setImageInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const InputField = ({ label, name, type = "text", placeholder = "" }: { label: string, name: string, type?: string, placeholder?: string }) => (
    <div className="space-y-1">
      <label className="text-sm font-bold text-gray-700">{label}</label>
      <input 
        type={type}
        name={name}
        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        placeholder={placeholder}
        value={(formData as any)[name]}
        onChange={handleChange}
        required
      />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Submit New Product</h2>
        <p className="text-gray-500">Add a new Amazon product for content generation</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <InputField label="ASIN" name="asin" placeholder="e.g. B08N5WRWJ5" />
          <InputField label="Product Name" name="name" placeholder="Full product title" />
          <InputField label="Category" name="category" placeholder="Electronics, Kitchen, etc." />
          <InputField label="Price" name="price" placeholder="$99.99" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-bold text-gray-700">Description</label>
          <textarea 
            name="description"
            className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[100px]"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-bold text-gray-700">Key Features</label>
          <div className="flex gap-2">
            <input 
              type="text"
              className="flex-1 p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Add a feature point..."
              value={featureInput}
              onChange={(e) => setFeatureInput(e.target.value)}
            />
            <button 
              type="button" 
              onClick={handleAddFeature}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Add
            </button>
          </div>
          <ul className="space-y-2">
            {formData.features?.map((f, i) => (
              <li key={i} className="text-sm flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <InputField label="Customer Feedback Themes" name="customerFeedbackThemes" placeholder="Quality, Ease of use, Durable..." />
          <InputField label="Target Audience" name="targetAudience" placeholder="Home cooks, Professionals..." />
          <InputField label="SEO Keywords" name="seoKeywords" placeholder="coffee maker, espresso, morning brew..." />
        </div>

        <div className="pt-6 flex gap-3 justify-end border-t border-gray-100">
          <button 
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 text-gray-600 font-medium hover:text-gray-900"
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-lg font-bold transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Product
          </button>
        </div>
      </form>
    </div>
  );
};

export default App;
