import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="max-w-md w-full bg-[#151515] border border-[#C9A34A]/40 rounded-sm p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle
              className={`w-5 h-5 shrink-0 ${
                destructive ? 'text-red-400' : 'text-[#C9A34A]'
              }`}
            />
            <h3
              id="confirm-dialog-title"
              className="font-display text-2xl text-white font-medium"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Fechar diálogo"
            className="text-[#A5A5A5] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-[#A5A5A5] leading-relaxed mb-6">{description}</p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 border border-white/15 hover:border-white/40 text-xs uppercase tracking-[0.12em] text-white/80 rounded-sm transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] rounded-sm transition-colors cursor-pointer disabled:opacity-50 ${
              destructive
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-[#C9A34A] hover:bg-[#E2C47A] text-[#080808]'
            }`}
          >
            {loading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
