-- RC.44: classify future generic audit entries at the database boundary.
-- Safe to rerun. Does not modify existing records. Does not alter RLS.
CREATE OR REPLACE FUNCTION public.audit_classify_generic_action()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  IF NEW.action = 'system_event' THEN
    NEW.action := CASE NEW.entity_type || '|' || COALESCE(NEW.summary,'')
      WHEN 'activity_tracking_segment|מקטע מעקב פעילות נערך' THEN 'activity.segment.updated'
      WHEN 'attendance_session|דיווח יציאה' THEN 'attendance.checked_out'
      WHEN 'attendance_session|דיווח כניסה' THEN 'attendance.checked_in'
      WHEN 'attendance_session|תיקון דיווח נוכחות על ידי מנהל' THEN 'attendance.corrected'
      WHEN 'development_mode|מצב פיתוח אישי כובה' THEN 'development_mode.disabled'
      WHEN 'development_mode|מצב פיתוח אישי הופעל' THEN 'development_mode.enabled'
      WHEN 'dynamic_availability_period|מועד אחרון להגשת אילוצים עודכן' THEN 'availability.deadline.updated'
      WHEN 'dynamic_availability_period|תוקנה קדימות יום שישי/שבת בתקופת אילוצים' THEN 'availability.period.weekend_priority_fixed'
      WHEN 'dynamic_availability_period|תקופת אילוצים עודכנה בעקבות שינוי מבנה תפקיד' THEN 'availability.period.synced'
      WHEN 'dynamic_historical_assignment|שיבוץ היסטורי תוקן על ידי מנהל מורשה' THEN 'schedule.historical_assignment.corrected'
      WHEN 'dynamic_job_type|סוג תפקיד דינמי הוקפא' THEN 'dynamic_job_type.frozen'
      WHEN 'dynamic_job_type|סוג תפקיד דינמי נמחק' THEN 'dynamic_job_type.deleted'
      WHEN 'dynamic_job_type|סוג תפקיד דינמי הופעל מחדש' THEN 'dynamic_job_type.reactivated'
      WHEN 'dynamic_schedule_draft|שיבוץ בטיוטה הדינמית נערך ידנית' THEN 'schedule.draft.updated'
      WHEN 'dynamic_schedule_draft|טיוטת סבב חודשי דינמי נוצרה' THEN 'schedule.draft.created'
      WHEN 'dynamic_schedule_publication|שיבוץ בלוח דינמי שונה על ידי מנהל' THEN 'schedule.assignment.updated'
      WHEN 'dynamic_schedule_publication|משמרת בלוח דינמי סומנה כלא מאוישת' THEN 'schedule.assignment.unassigned'
      WHEN 'dynamic_schedule_publication|לוח דינמי פורסם' THEN 'schedule.published'
      WHEN 'dynamic_schedule_publication|נשלחה התראת פרסום לוח דינמי' THEN 'notification.schedule_published.sent'
      WHEN 'dynamic_schedule_publication|עמדה לא מאוישת בלוח דינמי אוישה על ידי מנהל' THEN 'schedule.assignment.filled'
      WHEN 'dynamic_schedule_publication|שיבוץ בלוח דינמי שונה על ידי עובד במסגרת עריכה עצמית' THEN 'schedule.assignment.self_updated'
      WHEN 'dynamic_schedule_publication|שיבוץ של עובד אחר בלוח דינמי שונה על ידי עובד מורשה' THEN 'schedule.assignment.delegated_updated'
      WHEN 'dynamic_schedule_publication|שיבוץ אישי בלוח דינמי שונה על ידי העובד' THEN 'schedule.assignment.self_updated'
      WHEN 'job_type|הגדרות תזכורות אוטומטיות לאילוצים עודכנו' THEN 'job_type.reminders.updated'
      WHEN 'job_type|סבב חודשי אותחל' THEN 'job_type.rotation.initialized'
      WHEN 'job_type|סבב חודשי עודכן ידנית' THEN 'job_type.rotation.updated'
      WHEN 'job_type_membership|עובד צורף לתפקיד דינמי' THEN 'dynamic_job_type.member.added'
      WHEN 'notification|נשלח עדכון יזום לעובדי המערכת' THEN 'notification.announcement.sent'
      ELSE NEW.action
    END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS audit_classify_generic_action_before_insert ON public.audit_logs;
CREATE TRIGGER audit_classify_generic_action_before_insert
BEFORE INSERT ON public.audit_logs FOR EACH ROW
EXECUTE FUNCTION public.audit_classify_generic_action();

REVOKE ALL ON FUNCTION public.audit_classify_generic_action() FROM PUBLIC, anon, authenticated;
