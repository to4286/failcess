import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CommentNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean | void>;
  isLoading?: boolean;
}

const CommentNotificationModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: CommentNotificationModalProps) => {
  const handleConfirm = async () => {
    const result = await onConfirm();
    if (result !== false) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            해당 게시물의 댓글 알림을 받으시겠습니까?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            언제든지 변경할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            나중에
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? '처리 중...' : '알림 받기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CommentNotificationModal;
