import { useEffect, useRef, useState } from "react";
import { Trash2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Variant configuration -------------------------------------------------

const VARIANT_CONFIG = {
  danger: {
    iconWrapperClass:
      "bg-rose-100 dark:bg-rose-900/30",
    iconClass: "text-rose-500 dark:text-rose-400",
    confirmClass:
      "bg-rose-500 hover:bg-rose-600 focus-visible:ring-rose-500",
    Icon: Trash2,
  },
  warning: {
    iconWrapperClass:
      "bg-amber-100 dark:bg-amber-900/30",
    iconClass: "text-amber-500 dark:text-amber-400",
    confirmClass:
      "bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-500",
    Icon: AlertTriangle,
  },
  info: {
    iconWrapperClass:
      "bg-sky-100 dark:bg-sky-900/30",
    iconClass: "text-sky-500 dark:text-sky-400",
    confirmClass:
      "bg-sky-500 hover:bg-sky-600 focus-visible:ring-sky-500",
    Icon: Info,
  },
};

// --- Spinner ----------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// --- ConfirmModal -----------------------------------------------------------

/**
 * ConfirmModal
 *
 * Props:
 *   open          {boolean}
 *   onOpenChange  {(open: boolean) => void}
 *   title         {string}
 *   description   {string}
 *   variant       {"danger" | "warning" | "info"}  — default "danger"
 *   confirmLabel  {string}                          — default "Confirmar"
 *   cancelLabel   {string}                          — default "Cancelar"
 *   onConfirm     {() => void}
 *   loading       {boolean}                         — optional
 */
export const ConfirmModal = ({
  open,
  onOpenChange,
  title,
  description,
  variant = "danger",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  loading = false,
}) => {
  // Controls the CSS transition state of the panel (scale + opacity).
  const [visible, setVisible] = useState(false);
  const cancelRef = useRef(null);

  // Trigger enter transition one tick after the component mounts into the DOM.
  useEffect(() => {
    if (!open) return;

    const id = setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(id);
  }, [open]);

  // Reset transition state when the modal closes so the next open starts
  // from the correct initial state.
  useEffect(() => {
    if (!open) setVisible(false);
  }, [open]);

  // Autofocus the cancel button when the modal opens (safer default).
  useEffect(() => {
    if (open && visible && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [open, visible]);

  // Close on Escape key.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onOpenChange]);

  // Prevent body scroll while modal is open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.danger;
  const { iconWrapperClass, iconClass, confirmClass, Icon } = config;

  const handleBackdropClick = () => {
    if (!loading) onOpenChange(false);
  };

  const handlePanelClick = (e) => {
    // Prevent clicks inside the panel from bubbling to the backdrop.
    e.stopPropagation();
  };

  const handleConfirm = () => {
    if (loading) return;
    onConfirm?.();
  };

  const handleCancel = () => {
    if (loading) return;
    onOpenChange(false);
  };

  return (
    // Backdrop
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-black/60 backdrop-blur-sm",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0"
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
    >
      {/* Panel */}
      <div
        className={cn(
          "relative max-w-sm w-full mx-4",
          "bg-card border border-border",
          "rounded-2xl shadow-2xl",
          "transition-all duration-200",
          visible
            ? "scale-100 opacity-100"
            : "scale-95 opacity-0"
        )}
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        onClick={handlePanelClick}
      >
        {/* Top section — icon + title + description */}
        <div className="p-6 pb-4 flex flex-col items-center">
          {/* Icon circle */}
          <div
            className={cn(
              "flex items-center justify-center",
              "w-12 h-12 rounded-full",
              iconWrapperClass
            )}
            aria-hidden="true"
          >
            <Icon className={cn("w-5 h-5", iconClass)} strokeWidth={2} />
          </div>

          {/* Title */}
          <h2
            id="confirm-modal-title"
            className="text-base font-semibold text-foreground mt-4 text-center"
          >
            {title}
          </h2>

          {/* Description */}
          {description && (
            <p
              id="confirm-modal-description"
              className="text-sm text-muted-foreground mt-1 text-center leading-relaxed"
            >
              {description}
            </p>
          )}
        </div>

        {/* Bottom section — action buttons */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          {/* Cancel */}
          <button
            ref={cancelRef}
            type="button"
            disabled={loading}
            onClick={handleCancel}
            className={cn(
              "flex-1 h-10 rounded-xl",
              "border border-border bg-transparent",
              "hover:bg-muted",
              "text-sm font-medium text-foreground",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:opacity-50 disabled:pointer-events-none"
            )}
          >
            {cancelLabel}
          </button>

          {/* Confirm */}
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className={cn(
              "flex-1 h-10 rounded-xl",
              "text-sm font-medium text-white",
              "inline-flex items-center justify-center gap-2",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              "disabled:opacity-70 disabled:pointer-events-none",
              confirmClass
            )}
          >
            {loading ? (
              <>
                <Spinner />
                <span>{confirmLabel}</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
