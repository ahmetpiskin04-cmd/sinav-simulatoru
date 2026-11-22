"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BookOpen, CircleAlert, Info, LoaderCircle, Menu, RotateCw } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { CourseView } from "@/components/dashboard/CourseView";
import { UploadMaterialModal } from "@/components/dashboard/UploadMaterialModal";
import { NewExamModal } from "@/components/dashboard/NewExamModal";
import { NewStudySetModal } from "@/components/dashboard/NewStudySetModal";
import { api, ApiRequestError } from "@/lib/client-api";
import type { Course, CourseDetail } from "@/lib/types";

const LAST_COURSE_KEY = "lastCourseId";

export function Dashboard() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [loadError, setLoadError] = useState<ApiRequestError | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // seçili dersi yeniden çekmek için
  const [uploadOpen, setUploadOpen] = useState(false);
  // Açık olan üretim penceresi (yalnızca açıkken çizilir; her açılışta seçimler sıfırlanır)
  const [creator, setCreator] = useState<null | "exam" | "review" | "study">(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notConfigured = loadError?.code === "SUPABASE_NOT_CONFIGURED";

  // Dersleri yükle (setState yalnızca istek bitince, geri çağrılarda)
  const loadCourses = useCallback(() => {
    return api.listCourses().then(
      (list) => {
        setCourses(list);
        setLoadError(null);
        setSelectedId((cur) => {
          if (cur && list.some((c) => c.id === cur)) return cur;
          const last = readLastCourse();
          return list.find((c) => c.id === last)?.id ?? list[0]?.id ?? null;
        });
      },
      (err: unknown) => {
        setCourses([]);
        setLoadError(err instanceof ApiRequestError ? err : new ApiRequestError("Dersler yüklenemedi.", 0));
      },
    );
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  // Seçili dersin ayrıntısını yükle
  useEffect(() => {
    if (!selectedId) return;
    let ignore = false;
    api
      .getCourse(selectedId)
      .then((d) => {
        if (ignore) return;
        setDetail(d);
        setDetailError(null);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        setDetail(null);
        setDetailError(err instanceof Error ? err.message : "Ders yüklenemedi.");
      });
    return () => {
      ignore = true;
    };
  }, [selectedId, reloadKey]);

  // Bildirim kendiliğinden kaybolsun
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function selectCourse(id: string) {
    if (id !== selectedId) {
      setDetail(null);
      setDetailError(null);
    }
    setSelectedId(id);
    setMobileNavOpen(false);
    try {
      localStorage.setItem(LAST_COURSE_KEY, id);
    } catch {}
  }

  async function createCourse(title: string) {
    const course = await api.createCourse(title);
    setCourses((prev) => [course, ...(prev ?? [])]);
    selectCourse(course.id);
  }

  async function deleteCourse() {
    if (!detail) return;
    const ok = window.confirm(
      `"${detail.course.title}" dersi; tüm materyalleri ve sınavlarıyla birlikte kalıcı olarak silinecek. Emin misin?`,
    );
    if (!ok) return;
    try {
      await api.deleteCourse(detail.course.id);
      setDetail(null);
      setSelectedId(null);
      setToast("Ders silindi.");
      await loadCourses();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Ders silinemedi.");
    }
  }

  const sidebar = (
    <Sidebar
      courses={courses}
      selectedId={selectedId}
      onSelect={selectCourse}
      onCreate={createCourse}
      disabled={!!loadError}
      onCloseMobile={() => setMobileNavOpen(false)}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Masaüstü kenar çubuğu */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* Mobil çekmece */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="flex">{sidebar}</div>
          <button
            type="button"
            className="flex-1 bg-zinc-950/40 backdrop-blur-[2px]"
            aria-label="Menüyü kapat"
            onClick={() => setMobileNavOpen(false)}
          />
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobil üst çubuk */}
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Dersleri göster"
          >
            <Menu className="size-5" />
          </button>
          <span className="truncate font-medium">{detail?.course.title ?? "Sınav Simülatörü"}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadError ? (
            notConfigured ? (
              <SetupNotice message={loadError.message} onRetry={loadCourses} />
            ) : (
              <CenteredMessage
                icon={<CircleAlert className="size-6 text-red-500" />}
                title="Dersler yüklenemedi"
                text={loadError.message}
                action={<RetryButton onClick={loadCourses} />}
              />
            )
          ) : courses === null || (selectedId && !detail && !detailError) ? (
            <div className="grid h-full place-items-center">
              <LoaderCircle className="size-6 animate-spin text-zinc-400" />
            </div>
          ) : detailError ? (
            <CenteredMessage
              icon={<CircleAlert className="size-6 text-red-500" />}
              title="Ders açılamadı"
              text={detailError}
              action={<RetryButton onClick={() => setReloadKey((k) => k + 1)} />}
            />
          ) : detail ? (
            <CourseView
              detail={detail}
              onUploadClick={() => setUploadOpen(true)}
              onCreateExamClick={() => setCreator("exam")}
              onReviewClick={() => setCreator("review")}
              onStudySetClick={() => setCreator("study")}
              onDelete={deleteCourse}
              onMaterialChange={(message, ok) => {
                setToast(message);
                if (ok) setReloadKey((k) => k + 1);
              }}
            />
          ) : (
            <CenteredMessage
              icon={<BookOpen className="size-6 text-indigo-500" />}
              title="İlk dersini ekle"
              text="Soldaki + düğmesiyle bir ders oluştur (örn. Operating Systems), ardından slaytlarını ve çıkmış sorularını yükle."
            />
          )}
        </div>
      </main>

      {detail && (
        <UploadMaterialModal
          open={uploadOpen}
          courseId={detail.course.id}
          courseTitle={detail.course.title}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => setReloadKey((k) => k + 1)}
        />
      )}

      {detail && (creator === "exam" || creator === "review") && (
        <NewExamModal
          mode={creator === "review" ? "review" : "normal"}
          courseId={detail.course.id}
          courseTitle={detail.course.title}
          materials={detail.materials}
          review={detail.review}
          onClose={() => setCreator(null)}
        />
      )}

      {detail && creator === "study" && (
        <NewStudySetModal
          courseId={detail.course.id}
          courseTitle={detail.course.title}
          materials={detail.materials}
          onClose={() => setCreator(null)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed right-4 bottom-4 left-4 z-50 mx-auto flex max-w-sm items-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg sm:left-auto dark:bg-zinc-100 dark:text-zinc-900"
        >
          <Info className="size-4 shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}

function readLastCourse() {
  try {
    return localStorage.getItem(LAST_COURSE_KEY);
  } catch {
    return null;
  }
}

function CenteredMessage({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1.5 text-sm text-zinc-500">{text}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      <RotateCw className="size-4" />
      Tekrar dene
    </button>
  );
}

function SetupNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-500/30 dark:bg-amber-500/5">
        <div className="mb-3 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
          <CircleAlert className="size-5" />
          Supabase bağlantısı gerekiyor
        </div>
        <p className="mb-4 text-sm text-amber-900/80 dark:text-amber-200/80">{message}</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            Supabase&apos;de proje aç, <b>SQL Editor</b>&apos;e <code className="font-mono">supabase/schema.sql</code>{" "}
            dosyasını yapıştırıp çalıştır.
          </li>
          <li>
            <code className="font-mono">.env.example</code> dosyasını <code className="font-mono">.env.local</code> olarak
            kopyala, URL ve service role anahtarını yaz.
          </li>
          <li>
            Geliştirme sunucusunu yeniden başlat (<code className="font-mono">npm run dev</code>).
          </li>
        </ol>
        <div className="mt-5">
          <RetryButton onClick={onRetry} />
        </div>
      </div>
    </div>
  );
}
