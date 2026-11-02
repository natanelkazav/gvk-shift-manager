/**
 * קובץ: src/components/users/dynamic/ScheduleGroupEditorModal.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור שיבוץ / קבוצה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ScheduleGroupEditorModalProps, ScheduleGroupEditorModal.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  Clock3,
  Eye,
  History,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { dynamicSchedulingService } from '../../../services/dynamicSchedulingService';
import type {
  DynamicDayKind,
  DynamicDayRule,
  DynamicPaySegment,
  DynamicScheduleGroup,
  DynamicSchedulePreview,
  SaveDynamicScheduleGroupInput,
  SaveDynamicShiftTemplateInput,
} from '../../../types/dynamicScheduling';
import { Button, Input, Modal, Textarea } from '../../ui';

/**
 * חוזה הנתונים ScheduleGroupEditorModalProps: שיבוץ / קבוצה / מאפייני הרכיב.
 */
interface ScheduleGroupEditorModalProps {
  // group — קבוצה.
  group: DynamicScheduleGroup;
  // isOpen — האם המצב פתוח.
  isOpen: boolean;
  // onClose — פונקציית סגירת התצוגה.
  onClose: () => void;
  onSaved: () => Promise<void>;
}

// dayKinds — יום.
const dayKinds: DynamicDayKind[] = [
  'weekday',
  'friday',
  'saturday',
  'holiday_eve',
  'holiday_full',
  'holiday_end',
  'chol_hamoed',
];

// dayKindLabels — יום.
const dayKindLabels: Record<DynamicDayKind, string> = {
  weekday: 'א׳–ה׳',
  friday: 'שישי',
  saturday: 'שבת',
  holiday_eve: 'ערב חג',
  holiday_full: 'חג מלא',
  holiday_end: 'יום אחרון / מוצאי חג',
  chol_hamoed: 'חול המועד',
  custom: 'מותאם אישית',
};

// behaviorLabels — הנתון behaviorLabels בהקשר הפעולה.
const behaviorLabels: Record<DynamicDayRule['behavior'], string> = {
  own_templates: 'מבנה משמרות עצמאי',
  inherit: 'כמו סוג יום אחר',
  no_work: 'אין עבודה',
};

/**
 * פעולה normalizeTime: נרמול זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
const normalizeTime = (value: string): string => value.slice(0, 5);

/**
 * פעולה makeRule: כלל.
 * @param dayKind — יום.
 * @param current — הנתון current בהקשר הפעולה.
 * @returns DynamicDayRule — הפלט בהתאם לחתימה.
 */
const makeRule = (
  dayKind: DynamicDayKind,
  current?: DynamicDayRule,
): DynamicDayRule => current ?? ({
  dayKind,
  behavior: 'own_templates',
  inheritDayKind: null,
  metadata: {},
});

/**
 * פעולה makeTemplate: תבנית.
 * @param dayKind — יום.
 * @param index — מיקום באוסף.
 * @returns SaveDynamicShiftTemplateInput — הפלט בהתאם לחתימה.
 */
const makeTemplate = (
  dayKind: DynamicDayKind,
  index: number,
): SaveDynamicShiftTemplateInput => ({
  code: `${dayKind}_shift_${Date.now()}_${index}`,
  name: 'משמרת חדשה',
  dayKind,
  startTime: '08:00',
  endTime: '16:00',
  hours200Percent: 0,
  minWorkers: 1,
  targetWorkers: 1,
  maxWorkers: 1,
  sortOrder: (index + 1) * 10,
  isActive: true,
  metadata: {},
  paySegments: [],
});

/**
 * פעולה toForm: המרה עבור הנתון toForm בהקשר הפעולה.
 * @param group — קבוצה.
 * @returns SaveDynamicScheduleGroupInput — הפלט בהתאם לחתימה.
 */
const toForm = (
  group: DynamicScheduleGroup,
): SaveDynamicScheduleGroupInput => ({
  id: group.id,
  name: group.name,
  description: group.description,
  isActive: group.isActive,
  changeSummary: '',
  shiftTemplates: group.shiftTemplates.map((shift) => ({
    id: shift.id,
    code: shift.code,
    name: shift.name,
    dayKind: shift.dayKind,
    startTime: normalizeTime(shift.startTime),
    endTime: normalizeTime(shift.endTime),
    hours200Percent: shift.hours200Percent ?? 0,
    minWorkers: shift.minWorkers,
    targetWorkers: shift.targetWorkers,
    maxWorkers: shift.maxWorkers,
    sortOrder: shift.sortOrder,
    isActive: shift.isActive,
    metadata: shift.metadata,
    paySegments: shift.paySegments.map((segment) => ({
      ...segment,
      startTime: normalizeTime(segment.startTime),
      endTime: normalizeTime(segment.endTime),
    })),
  })),
  dayRules: dayKinds.map((dayKind) =>
    makeRule(
      dayKind,
      group.dayRules.find((rule) => rule.dayKind === dayKind),
    )),
});

/**
 * פעולה ScheduleGroupEditorModal: שיבוץ / קבוצה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function ScheduleGroupEditorModal({
  group,
  isOpen,
  onClose,
  onSaved,
}: ScheduleGroupEditorModalProps) {
  // מצב מקומי: form — הנתון form בהקשר הפעולה; setForm מעדכנת אותו ומפעילה רינדור לפי React.
  const [form, setForm] = useState<SaveDynamicScheduleGroupInput>(() => toForm(group));
  // מצב מקומי: isSaving — האם שמירה מתבצעת; setIsSaving מעדכנת אותו ומפעילה רינדור לפי React.
  const [isSaving, setIsSaving] = useState(false);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);
  // מצב מקומי: preview — הנתון preview בהקשר הפעולה; setPreview מעדכנת אותו ומפעילה רינדור לפי React.
  const [preview, setPreview] = useState<DynamicSchedulePreview | null>(null);
  // מצב מקומי: isPreviewLoading — טעינה; setIsPreviewLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  // מצב מקומי: previewYear — שנה; setPreviewYear מעדכנת אותו ומפעילה רינדור לפי React.
  const [previewYear, setPreviewYear] = useState(new Date().getFullYear());
  // מצב מקומי: previewMonth — חודש; setPreviewMonth מעדכנת אותו ומפעילה רינדור לפי React.
  const [previewMonth, setPreviewMonth] = useState(new Date().getMonth() + 1);

  // ערך מחושב templatesByDay — תבניות / יום; נשמר בין רינדורים עד שינוי התלויות.
  const templatesByDay = useMemo(() => {
    // result — תוצאה; מיפוי לחיפוש לפי מפתח.
    const result = new Map<DynamicDayKind, SaveDynamicShiftTemplateInput[]>();
    // עיבוד כל פריט מתוך dayKinds בנפרד.
    for (const dayKind of dayKinds) result.set(dayKind, []);
    // עיבוד כל פריט מתוך form.shiftTemplates בנפרד.
    for (const template of form.shiftTemplates) {
      // current — הנתון current בהקשר הפעולה.
      const current = result.get(template.dayKind) ?? [];
      current.push(template);
      result.set(template.dayKind, current);
    }
    // עיבוד כל פריט מתוך result.values() בנפרד.
    for (const templates of result.values()) {
      templates.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return result;
  }, [form.shiftTemplates]);

  /**
   * פעולה updateRule: עדכון כלל.
   * @param dayKind — יום.
   * @param patch — הנתון patch בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const updateRule = (
    dayKind: DynamicDayKind,
    patch: Partial<DynamicDayRule>,
  ): void => {
    setForm((current) => ({
      ...current,
      dayRules: current.dayRules.map((rule) =>
        rule.dayKind === dayKind
          ? {
              ...rule,
              ...patch,
              inheritDayKind:
                patch.behavior && patch.behavior !== 'inherit'
                  ? null
                  : patch.inheritDayKind ?? rule.inheritDayKind,
            }
          : rule,
      ),
    }));
  };

  /**
   * פעולה updateTemplate: עדכון תבנית.
   * @param code — הנתון code בהקשר הפעולה.
   * @param patch — הנתון patch בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const updateTemplate = (
    code: string,
    patch: Partial<SaveDynamicShiftTemplateInput>,
  ): void => {
    setForm((current) => ({
      ...current,
      shiftTemplates: current.shiftTemplates.map((template) =>
        template.code === code ? { ...template, ...patch } : template,
      ),
    }));
  };

  /**
   * פעולה removeTemplate: הסרת תבנית.
   * @param code — הנתון code בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const removeTemplate = (code: string): void => {
    setForm((current) => ({
      ...current,
      shiftTemplates: current.shiftTemplates.filter((template) => template.code !== code),
    }));
  };

  /**
   * פעולה addTemplate: הוספת תבנית.
   * @param dayKind — יום.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const addTemplate = (dayKind: DynamicDayKind): void => {
    setForm((current) => ({
      ...current,
      shiftTemplates: [
        ...current.shiftTemplates,
        makeTemplate(dayKind, current.shiftTemplates.length),
      ],
    }));
  };

  /**
   * פעולה updatePaySegment: עדכון הנתון updatePaySegment בהקשר הפעולה.
   * @param templateCode — תבנית.
   * @param segmentIndex — מיקום באוסף.
   * @param patch — הנתון patch בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const updatePaySegment = (
    templateCode: string,
    segmentIndex: number,
    patch: Partial<DynamicPaySegment>,
  ): void => {
    // template — תבנית.
    const template = form.shiftTemplates.find((item) => item.code === templateCode);
    if (!template) return;

    const paySegments = template.paySegments.map((segment, index) =>
      index === segmentIndex ? { ...segment, ...patch } : segment,
    );
    updateTemplate(templateCode, { paySegments });
  };

  /**
   * פעולה addPaySegment: הוספת הנתון addPaySegment בהקשר הפעולה.
   * @param templateCode — תבנית.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const addPaySegment = (templateCode: string): void => {
    // template — תבנית.
    const template = form.shiftTemplates.find((item) => item.code === templateCode);
    if (!template) return;

    updateTemplate(templateCode, {
      paySegments: [
        ...template.paySegments,
        {
          startTime: template.startTime,
          endTime: template.endTime,
          multiplier: 1,
          label: '100%',
          sortOrder: (template.paySegments.length + 1) * 10,
        },
      ],
    });
  };

  /**
   * פעולה removePaySegment: הסרת הנתון removePaySegment בהקשר הפעולה.
   * @param templateCode — תבנית.
   * @param segmentIndex — מיקום באוסף.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const removePaySegment = (
    templateCode: string,
    segmentIndex: number,
  ): void => {
    // template — תבנית.
    const template = form.shiftTemplates.find((item) => item.code === templateCode);
    if (!template) return;
    updateTemplate(templateCode, {
      paySegments: template.paySegments.filter((_, index) => index !== segmentIndex),
    });
  };

  /**
   * פעולה validate: בדיקת תקינות של הנתון validate בהקשר הפעולה.
   * @returns string | null — הפלט בהתאם לחתימה.
   */
  const validate = (): string | null => {
    if (!form.name.trim()) return 'יש להזין שם למערך השיבוץ.';

    const seenCodes = new Set<string>();
    // עיבוד כל פריט מתוך form.shiftTemplates בנפרד.
    for (const template of form.shiftTemplates) {
      if (!template.code.trim()) return 'לכל משמרת חייב להיות קוד פנימי.';
      if (seenCodes.has(template.code)) return `קוד המשמרת ${template.code} מופיע יותר מפעם אחת.`;
      seenCodes.add(template.code);
      if (!template.name.trim()) return 'לכל משמרת חייב להיות שם.';
      if (template.startTime === template.endTime) return `שעת ההתחלה והסיום של ${template.name} זהות.`;
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר template.minWorkers < 0 || template.targetWorkers < template.minWorkers || template.maxWorkers < template.targetWorkers.
      if (
        template.minWorkers < 0 ||
        template.targetWorkers < template.minWorkers ||
        template.maxWorkers < template.targetWorkers
      ) {
        return `דרישות כוח האדם של ${template.name} אינן תקינות.`;
      }
      // עיבוד כל פריט מתוך template.paySegments בנפרד.
      for (const segment of template.paySegments) {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר segment.startTime === segment.endTime || segment.multiplier <= 0.
        if (segment.startTime === segment.endTime || segment.multiplier <= 0) {
          return `מקטע השכר במשמרת ${template.name} אינו תקין.`;
        }
      }
    }

    return null;
  };

  /**
   * פעולה אסינכרונית submit: הגשת הנתון submit בהקשר הפעולה.
   * @param event — אירוע.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    // validationError — אימות נתונים / שגיאה.
    const validationError = validate();
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר validationError.
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await dynamicSchedulingService.saveScheduleGroup({
        ...form,
        name: form.name.trim(),
        description: form.description?.trim() || null,
        changeSummary: form.changeSummary?.trim() || 'עריכת מערך שיבוץ',
      });
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'שמירת מערך השיבוץ נכשלה.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * פעולה אסינכרונית runPreview: הנתון runPreview בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const runPreview = async (): Promise<void> => {
    setIsPreviewLoading(true);
    setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // result — תוצאה.
      const result = await dynamicSchedulingService.previewScheduleGroup(
        group.id,
        previewYear,
        previewMonth,
      );
      setPreview(result);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'יצירת התצוגה המקדימה נכשלה.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={`עריכת מערך שיבוץ · ${group.name}`}
      onClose={() => !isSaving && onClose()}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>ביטול</Button>
          <Button type="submit" form="dynamic-schedule-group-form" disabled={isSaving}>
            {isSaving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
            שמור גרסה
          </Button>
        </>
      )}
    >
      <form id="dynamic-schedule-group-form" className="dynamic-schedule-editor" onSubmit={submit}>
        {error ? <div className="users-error" role="alert">{error}</div> : null}

        <div className="dynamic-editor-shadow-note">
          <History size={18} />
          <div>
            <strong>גרסת מערך {group.currentVersion}</strong>
            <span>השינויים נשמרים כהגדרה וגרסה חדשה בלבד. הם לא משנים לוחות, אילוצים או שכר פעילים.</span>
          </div>
        </div>

        <div className="dynamic-form-grid">
          <Input label="שם המערך" value={form.name} required onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input label="קוד" value={group.code} disabled helperText="קוד המערך נשאר קבוע לצורכי תאימות." />
          <Input label="סיכום שינוי" value={form.changeSummary ?? ''} placeholder="לדוגמה: שינוי שעות שישי" onChange={(event) => setForm({ ...form, changeSummary: event.target.value })} />
        </div>
        <Textarea label="תיאור" value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} />

        <section className="dynamic-editor-section">
          <div className="dynamic-editor-section-heading">
            <div>
              <h3>מבנה ימים וחגים</h3>
              <p>לכל סוג יום ניתן להגדיר משמרות משלו, לרשת סוג יום אחר או לקבוע שאין עבודה.</p>
            </div>
          </div>

          <div className="dynamic-day-rules-grid">
            {dayKinds.map((dayKind) => {
              // rule — כלל.
              const rule = form.dayRules.find((item) => item.dayKind === dayKind) ?? makeRule(dayKind);
              return (
                <article className="dynamic-day-rule-card" key={dayKind}>
                  <strong>{dayKindLabels[dayKind]}</strong>
                  <select
                    value={rule.behavior}
                    onChange={(event) => updateRule(dayKind, {
                      behavior: event.target.value as DynamicDayRule['behavior'],
                      inheritDayKind: event.target.value === 'inherit' ? (rule.inheritDayKind ?? 'weekday') : null,
                    })}
                  >
                    {Object.entries(behaviorLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                  {rule.behavior === 'inherit' ? (
                    <select
                      value={rule.inheritDayKind ?? 'weekday'}
                      onChange={(event) => updateRule(dayKind, { inheritDayKind: event.target.value as DynamicDayKind })}
                    >
                      {dayKinds.filter((item) => item !== dayKind).map((item) => <option key={item} value={item}>{dayKindLabels[item]}</option>)}
                    </select>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="dynamic-editor-section">
          <div className="dynamic-editor-section-heading">
            <div>
              <h3>תבניות משמרת</h3>
              <p>מינימום הוא הכיסוי ההכרחי. יעד ומקסימום מאפשרים להגדיר עובד נוסף כרצוי אך לא כחובה.</p>
            </div>
          </div>

          {dayKinds.map((dayKind) => {
            // rule — כלל.
            const rule = form.dayRules.find((item) => item.dayKind === dayKind);
            if (rule?.behavior !== 'own_templates') return null;
            // templates — תבניות.
            const templates = templatesByDay.get(dayKind) ?? [];

            return (
              <div className="dynamic-shift-family" key={dayKind}>
                <div className="dynamic-shift-family-title">
                  <strong>{dayKindLabels[dayKind]}</strong>
                  <Button type="button" variant="secondary" onClick={() => addTemplate(dayKind)}>
                    <Plus size={15} /> הוסף משמרת
                  </Button>
                </div>

                {templates.length === 0 ? <div className="dynamic-empty-note">אין משמרות מוגדרות לסוג יום זה.</div> : null}
                {templates.map((template) => (
                  <article className="dynamic-shift-editor-card" key={template.code}>
                    <div className="dynamic-shift-editor-main">
                      <Input label="שם" value={template.name} onChange={(event) => updateTemplate(template.code, { name: event.target.value })} />
                      <Input label="קוד" value={template.code} disabled={Boolean(template.id)} onChange={(event) => updateTemplate(template.code, { code: event.target.value.toLowerCase().replace(/\s+/g, '_') })} />
                      <label><span>התחלה</span><input type="time" value={template.startTime} onChange={(event) => updateTemplate(template.code, { startTime: event.target.value })} /></label>
                      <label><span>סיום</span><input type="time" value={template.endTime} onChange={(event) => updateTemplate(template.code, { endTime: event.target.value })} /></label>
                      <label><span>מינימום</span><input type="number" min="0" max="50" value={template.minWorkers} onChange={(event) => updateTemplate(template.code, { minWorkers: Number(event.target.value) })} /></label>
                      <label><span>יעד</span><input type="number" min="0" max="50" value={template.targetWorkers} onChange={(event) => updateTemplate(template.code, { targetWorkers: Number(event.target.value) })} /></label>
                      <label><span>מקסימום</span><input type="number" min="0" max="50" value={template.maxWorkers} onChange={(event) => updateTemplate(template.code, { maxWorkers: Number(event.target.value) })} /></label>
                      <button type="button" className="dynamic-danger-icon" onClick={() => removeTemplate(template.code)} aria-label={`מחיקת ${template.name}`}><Trash2 size={17} /></button>
                    </div>

                    <div className="dynamic-pay-segments">
                      <div className="dynamic-pay-segments-title">
                        <span><Clock3 size={15} /> מקטעי שכר בתוך המשמרת</span>
                        <button type="button" onClick={() => addPaySegment(template.code)}><Plus size={14} /> מקטע</button>
                      </div>
                      {template.paySegments.length === 0 ? <small>ללא מקטעים — מנוע השכר העתידי יוכל להשתמש בתעריף הבסיס של התפקיד.</small> : null}
                      {template.paySegments.map((segment, segmentIndex) => (
                        <div className="dynamic-pay-segment-row" key={`${template.code}-${segmentIndex}`}>
                          <input type="time" value={segment.startTime} onChange={(event) => updatePaySegment(template.code, segmentIndex, { startTime: event.target.value })} />
                          <span>→</span>
                          <input type="time" value={segment.endTime} onChange={(event) => updatePaySegment(template.code, segmentIndex, { endTime: event.target.value })} />
                          <label><input type="number" min="0.1" step="0.05" value={segment.multiplier} onChange={(event) => updatePaySegment(template.code, segmentIndex, { multiplier: Number(event.target.value) })} /> ×</label>
                          <input value={segment.label ?? ''} placeholder="100% / 200%" onChange={(event) => updatePaySegment(template.code, segmentIndex, { label: event.target.value })} />
                          <button type="button" onClick={() => removePaySegment(template.code, segmentIndex)} aria-label="מחיקת מקטע"><Trash2 size={15} /></button>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            );
          })}
        </section>

        <section className="dynamic-editor-section dynamic-preview-section">
          <div className="dynamic-editor-section-heading">
            <div>
              <h3>Preview חודשי</h3>
              <p>ה־Preview קורא את החגים האמיתיים אך אינו יוצר משמרות במסד הפעיל.</p>
            </div>
            <div className="dynamic-preview-controls">
              <input type="number" min="2020" max="2100" value={previewYear} onChange={(event) => setPreviewYear(Number(event.target.value))} aria-label="שנת preview" />
              <select value={previewMonth} onChange={(event) => setPreviewMonth(Number(event.target.value))} aria-label="חודש preview">
                {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
              </select>
              <Button type="button" variant="secondary" onClick={() => void runPreview()} disabled={isPreviewLoading}>
                {isPreviewLoading ? <LoaderCircle className="spin" size={16} /> : <Eye size={16} />}
                הצג Preview
              </Button>
            </div>
          </div>

          {preview ? (
            <div className="dynamic-preview-days">
              {preview.days.map((day) => (
                <div className={`dynamic-preview-day ${day.isNoWork ? 'is-off' : ''}`} key={day.date}>
                  <div>
                    <strong>{day.date}</strong>
                    <span>{day.weekdayName}{day.holidayName ? ` · ${day.holidayName}` : ''}</span>
                  </div>
                  <div className="dynamic-preview-shifts">
                    {day.isNoWork ? <span className="dynamic-preview-off">אין עבודה</span> : day.shifts.length ? day.shifts.map((shift) => (
                      <span key={shift.templateId} dir="ltr">
                        {normalizeTime(shift.startTime)}–{normalizeTime(shift.endTime)} · {shift.minWorkers}/{shift.targetWorkers}/{shift.maxWorkers}
                      </span>
                    )) : <span>אין תבנית</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </form>
    </Modal>
  );
}

export default ScheduleGroupEditorModal;
