"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** true iken (ör. yükleme sürerken) kapatılamaz */
  locked?: boolean;
}

/** Yerel <dialog> üzerine kurulu: odak hapsi ve Esc tarayıcıdan gelir. */
export function Modal({ open, title, onClose, children, locked = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    // Kapanınca, bileşen kaldırılınca ya da GİZLENİNCE kapat. Next 16 (cacheComponents)
    // önceki sayfayı <Activity> ile gizli tutar; açık kalan modal pencere tarayıcının
    // üst katmanında kalıp yeni sayfayı tıklanamaz hâle getirirdi.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !locked) onClose(); // arka plana tıklama
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/50 backdrop:backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={locked}
              className="rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Kapat"
            >
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
