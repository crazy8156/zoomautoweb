import { supabaseAdmin } from './supabase-admin';

function normalizeCourseTitle(title: string) {
  return title.trim().replace(/\s+/g, ' ');
}

async function getDefaultCourseOwnerId() {
  const preferredRoles = ['teacher', 'admin'];

  for (const role of preferredRoles) {
    const { data, error } = await supabaseAdmin.from('profiles').select('id').eq('role', role).limit(1);
    if (error) {
      throw new Error(`Failed to load profile for role ${role}: ${error.message}`);
    }
    if (data?.[0]?.id) {
      return data[0].id;
    }
  }

  const { data: fallbackProfiles, error: fallbackProfilesError } = await supabaseAdmin.from('profiles').select('id').limit(1);
  if (fallbackProfilesError) {
    throw new Error(`Failed to load fallback profile: ${fallbackProfilesError.message}`);
  }

  if (fallbackProfiles?.[0]?.id) {
    return fallbackProfiles[0].id;
  }

  throw new Error('No profile found for creating a course owner.');
}

export async function findOrCreateCourseByTitle(rawTitle: string) {
  const title = normalizeCourseTitle(rawTitle);

  if (!title) {
    throw new Error('Please enter a course name first.');
  }

  const { data: existingCourses, error: existingCoursesError } = await supabaseAdmin
    .from('courses')
    .select('id,title')
    .ilike('title', title)
    .limit(1);

  if (existingCoursesError) {
    throw new Error(`Failed to find course: ${existingCoursesError.message}`);
  }

  const existingCourse = existingCourses?.[0];
  if (existingCourse?.id) {
    return {
      id: existingCourse.id,
      title: existingCourse.title,
      created: false,
    };
  }

  const teacherId = await getDefaultCourseOwnerId();

  const { data: createdCourse, error: createdCourseError } = await supabaseAdmin
    .from('courses')
    .insert({
      title,
      teacher_id: teacherId,
      description: null,
      price: 0,
      max_students: 999,
      duration_minutes: 60,
      is_active: true,
    })
    .select('id,title')
    .single();

  if (createdCourseError) {
    throw new Error(`Failed to create course: ${createdCourseError.message}`);
  }

  return {
    id: createdCourse.id,
    title: createdCourse.title,
    created: true,
  };
}
