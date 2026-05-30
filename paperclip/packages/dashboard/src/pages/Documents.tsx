import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Template } from '../api/client';

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ['テンプレート選択', '項目入力', 'プレビュー', 'PDF生成'];

export function Documents() {
  const [step, setStep] = useState<Step>(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [renderedContent, setRenderedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.trading.getTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'テンプレートの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean)));
  const templatesByCategory = categories.map(cat => ({
    category: cat,
    templates: templates.filter(t => t.category === cat),
  }));

  const handleSelectTemplate = (t: Template) => {
    setSelectedTemplate(t);
    const initial: Record<string, string> = {};
    t.placeholders.forEach(p => { initial[p] = ''; });
    setFormValues(initial);
    setStep(2);
  };

  const handleNext = () => {
    if (step === 2 && selectedTemplate) {
      let content = selectedTemplate.content;
      Object.entries(formValues).forEach(([key, value]) => {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `[${key}]`);
      });
      setRenderedContent(content);
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(3);
  };

  const handleGeneratePdf = async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    setError('');
    try {
      const doc = await api.trading.createDocument({
        templateId: selectedTemplate.id,
        title: `${selectedTemplate.name} - ${new Date().toLocaleDateString('ja-JP')}`,
        content: renderedContent,
        fields: formValues,
      });
      setDocumentId(doc.id);
      const pdfResult = await api.trading.getDocumentPdf(doc.id);
      setPdfPath(pdfResult.pdfPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedTemplate(null);
    setFormValues({});
    setRenderedContent('');
    setDocumentId(null);
    setPdfPath(null);
    setError('');
  };

  return (
    <div>
      <h2 style={s.heading}>文書作成</h2>

      <div style={s.stepIndicator}>
        {STEP_LABELS.map((label, i) => (
          <div key={i} style={s.stepItem}>
            <div style={{
              ...s.stepCircle,
              backgroundColor: step > i + 1 ? '#166534' : step === i + 1 ? '#1e40af' : '#1e293b',
              color: step >= i + 1 ? '#e2e8f0' : '#64748b',
            }}>
              {i + 1}
            </div>
            <span style={{ ...s.stepLabel, color: step >= i + 1 ? '#e2e8f0' : '#64748b' }}>{label}</span>
            {i < STEP_LABELS.length - 1 && <div style={{
              ...s.stepLine,
              backgroundColor: step > i + 1 ? '#22c55e' : '#1e293b',
            }} />}
          </div>
        ))}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {/* Step 1: Template Selection */}
      {step === 1 && (
        <div>
          {loading ? (
            <div style={s.empty}>読み込み中...</div>
          ) : templatesByCategory.length === 0 ? (
            <div style={s.empty}>テンプレートがありません</div>
          ) : (
            templatesByCategory.map(group => (
              <div key={group.category} style={s.categorySection}>
                <h3 style={s.categoryTitle}>{group.category}</h3>
                <div style={s.templateGrid}>
                  {group.templates.map(t => (
                    <div key={t.id} style={s.templateCard} onClick={() => handleSelectTemplate(t)}>
                      <div style={s.templateName}>{t.name}</div>
                      <div style={s.templateDesc}>{t.description ?? `プレースホルダー: ${t.placeholders.join(', ')}`}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Step 2: Form Fill */}
      {step === 2 && selectedTemplate && (
        <div style={s.form}>
          <h3 style={s.formTitle}>{selectedTemplate.name}</h3>
          <div style={s.fieldList}>
            {selectedTemplate.placeholders.map(placeholder => (
              <div key={placeholder} style={s.field}>
                <label style={s.label}>{placeholder}</label>
                <input
                  style={s.input}
                  value={formValues[placeholder] ?? ''}
                  onChange={e => setFormValues({ ...formValues, [placeholder]: e.target.value })}
                  placeholder={`${placeholder}を入力`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div style={s.form}>
          <h3 style={s.formTitle}>プレビュー</h3>
          <div style={s.preview}>
            {renderedContent.split('\n').map((line, i) => (
              <div key={i} style={s.previewLine}>{line || ' '}</div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Generate PDF */}
      {step === 4 && (
        <div style={s.form}>
          <h3 style={s.formTitle}>PDF生成</h3>
          {pdfPath ? (
            <div style={s.successBox}>
              <div style={s.successText}>PDFが正常に生成されました</div>
              <div style={s.pdfInfo}>
                <span>ファイル: {pdfPath}</span>
              </div>
              <a href={pdfPath} target="_blank" rel="noopener noreferrer" style={s.downloadLink}>ダウンロード</a>
            </div>
          ) : (
            <div style={s.generateSection}>
              <p style={s.generateDesc}>「PDFを生成」ボタンをクリックして文書をPDFとして出力します。</p>
              <button style={s.generateBtn} onClick={handleGeneratePdf} disabled={generating}>
                {generating ? '生成中...' : 'PDFを生成'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      {step > 1 && (
        <div style={s.navButtons}>
          {step > 1 && <button style={s.backBtn} onClick={handleBack}>戻る</button>}
          {step < 4 && <button style={s.nextBtn} onClick={handleNext}>次へ</button>}
          {step === 4 && pdfPath && <button style={s.resetBtn} onClick={handleReset}>新規作成</button>}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  heading: { color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1.5rem 0' },
  stepIndicator: { display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '0' },
  stepItem: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  stepCircle: { width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600, flexShrink: 0 },
  stepLabel: { fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap' as const },
  stepLine: { width: '40px', height: '2px', margin: '0 0.25rem', flexShrink: 0 },
  error: { color: '#f87171', fontSize: '0.8rem', marginBottom: '0.5rem' },
  empty: { color: '#64748b', fontSize: '0.9rem', padding: '2rem', textAlign: 'center' as const },
  categorySection: { marginBottom: '1.5rem' },
  categoryTitle: { color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.75rem 0', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  templateGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' },
  templateCard: { backgroundColor: '#16213e', border: '1px solid #2a3a5c', borderRadius: '8px', padding: '1rem', cursor: 'pointer', transition: 'border-color 0.15s' },
  templateName: { color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.35rem' },
  templateDesc: { color: '#94a3b8', fontSize: '0.75rem', lineHeight: 1.4 },
  form: { backgroundColor: '#16213e', border: '1px solid #2a3a5c', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' },
  formTitle: { color: '#e2e8f0', fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' },
  fieldList: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' },
  label: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 },
  input: { backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #2a3a5c', borderRadius: '4px', padding: '0.5rem', fontSize: '0.85rem', fontFamily: 'inherit' },
  preview: { backgroundColor: '#0f172a', border: '1px solid #2a3a5c', borderRadius: '6px', padding: '1rem', maxHeight: '400px', overflowY: 'auto' as const },
  previewLine: { color: '#e2e8f0', fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const },
  successBox: { textAlign: 'center' as const, padding: '1.5rem' },
  successText: { color: '#4ade80', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' },
  pdfInfo: { color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' },
  downloadLink: { display: 'inline-block', backgroundColor: '#166534', color: '#4ade80', border: '1px solid #22c55e', borderRadius: '6px', padding: '0.5rem 1.5rem', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' },
  generateSection: { textAlign: 'center' as const, padding: '1.5rem' },
  generateDesc: { color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' },
  generateBtn: { backgroundColor: '#1e40af', color: '#93c5fd', border: '1px solid #3b82f6', borderRadius: '6px', padding: '0.6rem 2rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  navButtons: { display: 'flex', gap: '0.5rem', justifyContent: 'flex-start' },
  backBtn: { backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #2a3a5c', borderRadius: '6px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.85rem' },
  nextBtn: { backgroundColor: '#166534', color: '#4ade80', border: '1px solid #22c55e', borderRadius: '6px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  resetBtn: { backgroundColor: '#1e40af', color: '#93c5fd', border: '1px solid #3b82f6', borderRadius: '6px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
};
