import { useState, useEffect } from 'react';
import { Folder, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Folder as FolderType } from '@/types';
import { useAuthModal } from '@/hooks/useAuthModal';

const TEST_USER_ID = '55b95afa-aa07-45e7-8630-0d608b705bca';

interface FolderSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (folderId: string | null) => void;
  postId?: string; // 저장 취소를 위한 postId (선택적)
}

const FolderSelectModal = ({ open, onClose, onSelect, postId }: FolderSelectModalProps) => {
  const { openAuthModal } = useAuthModal();
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [user, setUser] = useState<any>(null);

  // 현재 로그인된 사용자 정보 가져오기
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      }
    };
    getCurrentUser();
  }, []);

  // 폴더 목록 가져오기
  useEffect(() => {
    if (open && user) {
      fetchFolders();
    }
  }, [open, user]);

  const fetchFolders = async () => {
    try {
      setIsLoading(true);
      
      // 이미 가져온 user 객체 사용
      if (!user) {
        console.error('User not authenticated');
        return;
      }
      
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching folders:', error);
        toast.error('폴더를 불러오는데 실패했습니다');
        return;
      }

      setFolders(data || []);
    } catch (err) {
      console.error('Error fetching folders:', err);
      toast.error('폴더를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // 새 폴더 생성
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newFolderName.trim()) {
      toast.error('폴더 이름을 입력해주세요');
      return;
    }

    try {
      setIsCreating(true);
      
      if (!user) {
        onClose();
        openAuthModal();
        return;
      }
      
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('folders')
        .insert({
          user_id: user.id, // 기존 user 객체의 ID 사용
          name: newFolderName.trim(),
          created_at: now,
          updated_at: now, // 정렬용
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating folder:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        
        // Handle RLS policy error specifically
        if (error.code === '42501') {
          toast.error('권한 설정 오류입니다. 관리자에게 문의하세요.', {
            duration: 4000,
          });
        } else {
          toast.error('폴더 생성에 실패했습니다');
        }
        return;
      }

      if (data) {
        setFolders([data, ...folders]);
        setNewFolderName('');
        setShowCreateForm(false);
        toast.success('폴더가 생성되었습니다');
      }
    } catch (err) {
      console.error('Error creating folder:', err);
      toast.error('폴더 생성에 실패했습니다');
    } finally {
      setIsCreating(false);
    }
  };

  // 폴더 선택
  const handleSelectFolder = (folderId: string | null) => {
    onSelect(folderId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-w-[90vw] overflow-hidden">
        <DialogHeader>
          <DialogTitle>폴더 선택</DialogTitle>
          <DialogDescription>
            게시물을 저장할 폴더를 선택하거나 새 폴더를 만드세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 새 폴더 만들기 버튼 */}
          {!showCreateForm ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              새 폴더 만들기
            </Button>
          ) : (
            <form onSubmit={handleCreateFolder} className="space-y-2">
              <Input
                placeholder="폴더 이름"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isCreating || !newFolderName.trim()}
                  className="flex-1"
                >
                  {isCreating ? '생성 중...' : '생성'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewFolderName('');
                  }}
                >
                  취소
                </Button>
              </div>
            </form>
          )}

          {/* 폴더 리스트 */}
          <div className="max-h-[400px] overflow-y-auto space-y-2 overflow-x-hidden">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                폴더를 불러오는 중...
              </div>
            ) : folders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                폴더가 없습니다. 새 폴더를 만들어보세요.
              </div>
            ) : (
              <>
                {/* 저장 취소 옵션 (postId가 있는 경우에만) */}
                {postId && (
                  <button
                    onClick={() => handleSelectFolder(null)}
                    className="w-full flex items-center justify-center px-4 py-3 rounded-lg border border-red-500 bg-white hover:bg-red-50 transition-colors font-medium text-red-600"
                  >
                    저장 취소
                  </button>
                )}
                
                {/* 폴더 목록 */}
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleSelectFolder(folder.id)}
                    className="w-full grid grid-cols-[auto_1fr] items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors overflow-hidden min-w-0"
                    style={{ maxWidth: '100%' }}
                  >
                    <Folder className="h-5 w-5 text-primary flex-shrink-0" />
                    <span 
                      className="truncate text-left font-medium min-w-0"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
                    >
                      {folder.name}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FolderSelectModal;
