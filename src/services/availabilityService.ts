import { supabase } from '../lib/supabase';
import type {
  AvailabilityPeriod,
  AvailabilityPeriodStatus,
  CreateAvailabilityPeriodInput,
  CreateAvailabilityPeriodResult,
} from '../types/availability';

interface AvailabilityPeriodDatabaseRow {
  id: string;
  year: number;
  month: number;
  status: AvailabilityPeriodStatus;
  title: string | null;
  instructions: string | null;
  submission_deadline: string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateAvailabilityPeriodDatabaseRow {
  period_id: string;
  created_slots: number;
  period_status: AvailabilityPeriodStatus;
}

function mapAvailabilityPeriod(
  row: AvailabilityPeriodDatabaseRow,
): AvailabilityPeriod {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    status: row.status,
    title: row.title,
    instructions: row.instructions,
    submissionDeadline:
      row.submission_deadline,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAvailabilityPeriods():
  Promise<AvailabilityPeriod[]> {
  const { data, error } = await supabase
    .from('availability_periods')
    .select(`
      id,
      year,
      month,
      status,
      title,
      instructions,
      submission_deadline,
      opened_at,
      closed_at,
      created_by,
      updated_by,
      created_at,
      updated_at
    `)
    .order('year', {
      ascending: false,
    })
    .order('month', {
      ascending: false,
    });

  if (error) {
    console.error(
      'GET AVAILABILITY PERIODS ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לטעון את תקופות האילוצים.',
    );
  }

  return (
    (
      data as
        | AvailabilityPeriodDatabaseRow[]
        | null
    ) ?? []
  ).map(mapAvailabilityPeriod);
}

async function createAvailabilityPeriod(
  input: CreateAvailabilityPeriodInput,
): Promise<CreateAvailabilityPeriodResult> {
  const {
    data,
    error,
  } = await supabase.rpc(
    'create_availability_period',
    {
      requested_year:
        input.year,

      requested_month:
        input.month,

      requested_submission_deadline:
        input.submissionDeadline,

      requested_title:
        input.title?.trim() ||
        null,

      requested_instructions:
        input.instructions?.trim() ||
        null,
    },
  );

  if (error) {
    console.error(
      'CREATE AVAILABILITY PERIOD ERROR:',
      error,
    );

    if (
      error.message
        .toLowerCase()
        .includes(
          'already exists',
        )
    ) {
      throw new Error(
        'כבר קיימת תקופת אילוצים עבור החודש שנבחר.',
      );
    }

    throw new Error(
      'לא ניתן היה ליצור את תקופת האילוצים.',
    );
  }

  const resultRows =
    data as
      | CreateAvailabilityPeriodDatabaseRow[]
      | null;

  const result =
    resultRows?.[0];

  if (!result) {
    throw new Error(
      'תקופת האילוצים נוצרה ללא תשובה תקינה מהשרת.',
    );
  }

  return {
    periodId:
      result.period_id,

    createdSlots:
      result.created_slots,

    periodStatus:
      result.period_status,
  };
}

export const availabilityService = {
  getAvailabilityPeriods,
  createAvailabilityPeriod,
};