import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type TemplateType = "free" | "diagnosis" | "verification";

interface TemplateSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTemplate: TemplateType;
  onSelectTemplate: (template: TemplateType) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const TEMPLATES: { id: TemplateType; label: string; description?: string }[] = [
  { id: "free", label: "자유형" },
  { id: "diagnosis", label: "진단형", description: "실패 원인을 분석합니다" },
  { id: "verification", label: "검증형", description: "과거의 배움이 성공으로 이어졌는지 증명합니다" },
];

export default function TemplateSelectModal({
  open,
  onOpenChange,
  selectedTemplate,
  onSelectTemplate,
  onConfirm,
  onClose,
}: TemplateSelectModalProps) {
  const handleClose = () => {
    onOpenChange(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px]"
        hideClose
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
      >
        <div className="relative">
          <button
            type="button"
            onClick={handleClose}
            className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 hover:bg-muted"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
          <DialogHeader className="pb-4">
            <DialogTitle className="text-center text-xl">
              템플릿을 선택해주세요
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 py-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTemplate(t.id)}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border-2 p-4 text-center transition-all min-h-[100px]",
                  selectedTemplate === t.id
                    ? "border-slate-800 bg-slate-50"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <span className="font-medium text-gray-900">{t.label}</span>
                {t.description && (
                  <span className="mt-1.5 text-xs text-muted-foreground">
                    {t.description}
                  </span>
                )}
              </button>
            ))}
          </div>

          <Button
            type="button"
            onClick={onConfirm}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white"
          >
            작성하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
