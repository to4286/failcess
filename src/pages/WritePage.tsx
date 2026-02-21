import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuthModal } from "@/hooks/useAuthModal";
import { INTEREST_TAGS } from "@/lib/constants";
import { getFilteredPreviewText } from "@/lib/utils";
import TemplateSelectModal, { type TemplateType } from "@/components/TemplateSelectModal";

const TEMPLATE_DIAGNOSIS_HTML = `<h2>어떤 일이 있었나요?</h2>
<p>(최대한 사실적으로 적어주세요)</p>
<h2>왜 그런 일이 일어났다고 생각하시나요?</h2>
<p>(놓친 것은 무엇인지 생각해보세요)</p>
<h2>새롭게 깨달은 사실은 무엇인가요?</h2>
<p></p>
<h2>같은 실수를 반복하지 않게 무엇을 다르게 할 건가요?</h2>
<p></p>`;

const TEMPLATE_VERIFICATION_HTML = `<h2>이번에 맞이한 새로운 상황을 설명해주세요.</h2>
<p></p>
<h2>유사한 과거 상황에서 겪었던 실패와 그 원인은 무엇이었나요?</h2>
<p></p>
<h2>과거의 피드백을 바탕으로 이번에는 무엇을 다르게 실행했나요?</h2>
<p>(과거 실패에서 배운 점을 포함해주세요)</p>
<h2>그 결과, 어떤 성공적인 변화나 성과를 얻었나요?</h2>
<p></p>`;

const WritePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editPostId = searchParams.get("edit");
  const { openAuthModal } = useAuthModal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublic, setIsPublic] = useState(true); // 공개 여부 (기본값: 전체 공개)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [user, setUser] = useState<any>(null);
  const [isPublishSettingsOpen, setIsPublishSettingsOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isFolderNotSelected, setIsFolderNotSelected] = useState(false); // false = 기본 드롭다운 활성, 체크 안 됨
  const [folderPopoverOpen, setFolderPopoverOpen] = useState(false);
  const [isLoadingEditPost, setIsLoadingEditPost] = useState(false);
  const [editPostLoaded, setEditPostLoaded] = useState(false);
  const editContentSetRef = useRef(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("free");
  const templateModalHandledRef = useRef(false);
  const pendingTemplateRef = useRef<TemplateType | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
  });

  const TEST_USER_ID = '55b95afa-aa07-45e7-8630-0d608b705bca';

  // 현재 로그인된 사용자 정보 가져오기
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        openAuthModal();
      }
    };
    getCurrentUser();

    // 세션 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        navigate('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, openAuthModal]);

  // 새 글쓰기 시 템플릿 모달 표시
  useEffect(() => {
    if (user && !editPostId && !templateModalHandledRef.current) {
      templateModalHandledRef.current = true;
      setShowTemplateModal(true);
    }
  }, [user, editPostId]);

  // 수정 모드: 게시물 데이터 불러오기 및 pre-fill
  useEffect(() => {
    if (!editPostId || !user) return;
    let cancelled = false;
    setIsLoadingEditPost(true);
    (async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, content, is_public, scope, folder_id, categories")
        .eq("id", editPostId)
        .eq("author_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setIsLoadingEditPost(false);
      if (error || !data) return;
      const cats = Array.isArray(data.categories)
        ? data.categories
        : typeof data.categories === "string"
          ? (() => {
              try {
                const p = JSON.parse(data.categories);
                return Array.isArray(p) ? p : [];
              } catch {
                return [];
              }
            })()
          : [];
      const isPublic = data.is_public ?? data.scope !== "private";
      const folderId = data.folder_id ?? null;
      setFormData({ title: data.title ?? "", content: data.content ?? "" });
      setIsPublic(isPublic);
      setSelectedFolderId(folderId);
      setIsFolderNotSelected(!folderId);
      setSelectedCategories(cats);
      setEditPostLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [editPostId, user?.id]);

  // 폴더 목록 가져오기
  useEffect(() => {
    const fetchFolders = async () => {
      try {
        setIsLoadingFolders(true);
        if (!user) {
          setFolders([]);
          return;
        }

        const { data, error } = await supabase
          .from('folders')
          .select('id, name')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('Error fetching folders:', error);
          // 에러가 발생해도 빈 배열로 설정하여 페이지가 계속 렌더링되도록 함
          setFolders([]);
          return;
        }

        setFolders(data || []);
      } catch (err) {
        console.error('Error fetching folders:', err);
        // 에러가 발생해도 빈 배열로 설정하여 페이지가 계속 렌더링되도록 함
        setFolders([]);
      } finally {
        setIsLoadingFolders(false);
      }
    };

    if (user) {
      fetchFolders();
    }
  }, [user]);

  // 이미지 업로드 함수
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      console.log('Starting image upload...', { fileName: file.name, fileSize: file.size, fileType: file.type });
      
      // 파일명 생성 (중복 방지) - Date와 Math.random 조합
      const fileExt = file.name.split('.').pop() || 'jpg';
      const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const fileName = `${uniqueId}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log('Uploading to path:', filePath);

      // Supabase Storage에 업로드
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        console.error('Error details:', {
          message: error.message,
        });
        toast.error(`이미지 업로드 실패: ${error.message || '알 수 없는 오류'}`);
        return null;
      }

      console.log('Upload successful, data:', data);

      // Public URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      console.log('Public URL:', publicUrl);

      return publicUrl;
    } catch (error: any) {
      console.error('Unexpected upload error:', error);
      toast.error(`이미지 업로드 실패: ${error?.message || '알 수 없는 오류'}`);
      return null;
    }
  };

  // Tiptap 에디터 설정
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Markdown shortcuts는 StarterKit에 기본 포함
      }),
      Image.configure({
        inline: true,
        allowBase64: false,
      }),
      Placeholder.configure({
        placeholder: "내용을 입력하세요",
      }),
    ],
    content: formData.content,
    editorProps: {
      attributes: {
        class: "outline-none focus:outline-none prose prose-lg max-w-none prose-headings:font-bold prose-img:rounded-lg prose-img:shadow-md prose-img:my-6 prose-p:text-lg prose-p:leading-relaxed prose-p:text-gray-900 prose-ul:list-disc prose-ul:ml-6 prose-ol:list-decimal prose-ol:ml-6 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:py-1 prose-blockquote:my-4 prose-blockquote:italic prose-blockquote:text-gray-700 prose-blockquote:bg-gray-50 prose-blockquote:rounded-r break-all whitespace-pre-wrap [&_.is-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-empty:first-child::before]:text-gray-400 [&_.is-empty:first-child::before]:float-left [&_.is-empty:first-child::before]:pointer-events-none [&_.is-empty:first-child::before]:h-0",
      },
      handleDrop: (view, event, slice, moved) => {
        // moved가 true면 이미 에디터 내부에서 이동한 것이므로 처리하지 않음
        if (moved) {
          return false;
        }

        // 파일이 있는지 확인
        if (!event.dataTransfer || !event.dataTransfer.files || event.dataTransfer.files.length === 0) {
          return false;
        }

        const file = event.dataTransfer.files[0];
        
        // 이미지 파일인지 확인
        if (!file.type.startsWith('image/')) {
          console.log('Not an image file:', file.type);
          return false;
        }

        console.log('Image file detected:', { name: file.name, type: file.type, size: file.size });

        // 기본 동작 완전히 차단 (새 탭 열림 방지)
        event.preventDefault();
        event.stopPropagation();

        setIsUploading(true);

        // 드롭된 위치 좌표 계산 (업로드 전에 미리 계산)
        const coordinates = view.posAtCoords({ 
          left: event.clientX, 
          top: event.clientY 
        });
        const insertPos = coordinates?.pos ?? view.state.selection.anchor;

        console.log('Drop position:', { coordinates, insertPos, selection: view.state.selection.anchor });

        // 이미지 업로드 및 삽입
        uploadImage(file)
          .then((imageUrl) => {
            if (!imageUrl) {
              console.error('Image URL is null');
              setIsUploading(false);
              return;
            }

            console.log('Image uploaded successfully, URL:', imageUrl);
            console.log('Inserting into editor at position:', insertPos);
            console.log('Editor instance:', editor ? 'exists' : 'null');
            console.log('View state:', { docSize: view.state.doc.content.size, selection: view.state.selection });

            // editor 인스턴스를 사용하여 이미지 삽입 (더 안정적)
            if (editor && !editor.isDestroyed) {
              try {
                // 현재 커서 위치로 이동 후 이미지 삽입
                editor.chain()
                  .focus()
                  .setTextSelection(insertPos)
                  .setImage({ src: imageUrl })
                  .run();
                
                console.log('Image inserted successfully using editor.chain()');
                toast.success('이미지가 업로드되었습니다.');
              } catch (chainError: any) {
                console.error('Error using editor.chain():', chainError);
                // Fallback: 직접 트랜잭션 사용
                try {
                  const { schema } = view.state;
                  if (!schema.nodes.image) {
                    console.error('Image node not found in schema');
                    toast.error('이미지 노드를 찾을 수 없습니다.');
                    setIsUploading(false);
                    return;
                  }
                  const imageNode = schema.nodes.image.create({ 
                    src: imageUrl 
                  });
                  const transaction = view.state.tr.insert(insertPos, imageNode);
                  view.dispatch(transaction);
                  console.log('Image inserted using fallback transaction method');
                  toast.success('이미지가 업로드되었습니다.');
                } catch (fallbackError: any) {
                  console.error('Fallback transaction error:', fallbackError);
                  toast.error(`이미지 삽입 실패: ${fallbackError?.message || '알 수 없는 오류'}`);
                }
              }
            } else {
              console.warn('Editor instance is null or destroyed, using fallback');
              // Fallback: 직접 트랜잭션 사용
              try {
                const { schema } = view.state;
                if (!schema.nodes.image) {
                  console.error('Image node not found in schema');
                  toast.error('이미지 노드를 찾을 수 없습니다.');
                  setIsUploading(false);
                  return;
                }
                const imageNode = schema.nodes.image.create({ 
                  src: imageUrl 
                });
                const transaction = view.state.tr.insert(insertPos, imageNode);
                view.dispatch(transaction);
                console.log('Image inserted using fallback transaction method');
                toast.success('이미지가 업로드되었습니다.');
              } catch (fallbackError: any) {
                console.error('Fallback transaction error:', fallbackError);
                toast.error(`이미지 삽입 실패: ${fallbackError?.message || '알 수 없는 오류'}`);
              }
            }
            
            setIsUploading(false);
          })
          .catch((error) => {
            console.error('Image upload promise error:', error);
            toast.error(`이미지 업로드 실패: ${error?.message || '알 수 없는 오류'}`);
            setIsUploading(false);
          });

        // 반드시 true 반환하여 브라우저 기본 동작 방지
        return true;
      },
      handlePaste: (view, event, slice) => {
        // 클립보드에서 이미지 가져오기
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(item => item.type.startsWith('image/'));

        // 이미지가 없으면 기본 동작 허용
        if (!imageItem) {
          return false;
        }

        // 기본 동작 차단
        event.preventDefault();
        event.stopPropagation();

        const file = imageItem.getAsFile();
        
        if (!file) {
          return false;
        }

        setIsUploading(true);

        // 비동기 로직은 분리해서 실행 (Fire & Forget)
        uploadImage(file)
          .then((imageUrl) => {
            if (!imageUrl) {
              console.error('Image URL is null');
              setIsUploading(false);
              return;
            }

            console.log('Image uploaded successfully, URL:', imageUrl);

            // editor 인스턴스를 사용하여 이미지 삽입
            if (editor && !editor.isDestroyed) {
              try {
                editor.chain()
                  .focus()
                  .setImage({ src: imageUrl })
                  .run();
                
                console.log('Image inserted successfully using editor.chain()');
                toast.success('이미지가 업로드되었습니다.');
              } catch (chainError: any) {
                console.error('Error using editor.chain():', chainError);
                // Fallback: 직접 트랜잭션 사용
                try {
                  const { schema } = view.state;
                  if (!schema.nodes.image) {
                    console.error('Image node not found in schema');
                    toast.error('이미지 노드를 찾을 수 없습니다.');
                    setIsUploading(false);
                    return;
                  }
                  const imageNode = schema.nodes.image.create({ 
                    src: imageUrl 
                  });
                  const currentPos = view.state.selection.anchor;
                  const transaction = view.state.tr.insert(currentPos, imageNode);
                  view.dispatch(transaction);
                  console.log('Image inserted using fallback transaction method');
                  toast.success('이미지가 업로드되었습니다.');
                } catch (fallbackError: any) {
                  console.error('Fallback transaction error:', fallbackError);
                  toast.error(`이미지 삽입 실패: ${fallbackError?.message || '알 수 없는 오류'}`);
                }
              }
            } else {
              console.warn('Editor instance is null or destroyed, using fallback');
              // Fallback: 직접 트랜잭션 사용
              try {
                const { schema } = view.state;
                if (!schema.nodes.image) {
                  console.error('Image node not found in schema');
                  toast.error('이미지 노드를 찾을 수 없습니다.');
                  setIsUploading(false);
                  return;
                }
                const imageNode = schema.nodes.image.create({ 
                  src: imageUrl 
                });
                const currentPos = view.state.selection.anchor;
                const transaction = view.state.tr.insert(currentPos, imageNode);
                view.dispatch(transaction);
                console.log('Image inserted using fallback transaction method');
                toast.success('이미지가 업로드되었습니다.');
              } catch (fallbackError: any) {
                console.error('Fallback transaction error:', fallbackError);
                toast.error(`이미지 삽입 실패: ${fallbackError?.message || '알 수 없는 오류'}`);
              }
            }
            
            setIsUploading(false);
          })
          .catch((error) => {
            console.error('Image upload promise error:', error);
            toast.error(`이미지 업로드 실패: ${error?.message || '알 수 없는 오류'}`);
            setIsUploading(false);
          });

        // 즉시 true 반환하여 타입 에러 해결
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      // 에디터 내용이 변경될 때마다 HTML을 content에 저장
      const html = editor.getHTML();
      setFormData(prev => ({ ...prev, content: html }));

      // 커서가 화면 하단에 머물지 않도록, 중앙(50%) 지점 도달 시 자동 스크롤
      requestAnimationFrame(() => {
        try {
          const { view } = editor;
          const pos = view.state.selection.anchor;
          const coords = view.coordsAtPos(pos);
          const centerY = window.innerHeight * 0.5;
          if (coords.bottom >= centerY) {
            const scrollDelta = coords.bottom - centerY;
            window.scrollTo({ top: window.scrollY + scrollDelta, behavior: "smooth" });
          }
        } catch {
          /* 무시 */
        }
      });
    },
  });

  // 수정 모드: 에디터에 불러온 본문 주입 (1회)
  useEffect(() => {
    if (!editor || !editPostId || !editPostLoaded || editContentSetRef.current) return;
    const html = formData.content;
    if (!html || html === "<p></p>" || html.trim() === "") return;
    editor.commands.setContent(html);
    editContentSetRef.current = true;
  }, [editor, editPostId, editPostLoaded, formData.content]);

  // 커서 위치 변경 시(클릭, 화살표 등)에도 하단 고정 방지
  useEffect(() => {
    if (!editor) return;
    const scrollCursorToCenter = () => {
      requestAnimationFrame(() => {
        try {
          const { view } = editor;
          const pos = view.state.selection.anchor;
          const coords = view.coordsAtPos(pos);
          const centerY = window.innerHeight * 0.5;
          if (coords.bottom >= centerY) {
            const scrollDelta = coords.bottom - centerY;
            window.scrollTo({ top: window.scrollY + scrollDelta, behavior: "smooth" });
          }
        } catch {
          /* 무시 */
        }
      });
    };
    editor.on("selectionUpdate", scrollCursorToCenter);
    return () => {
      editor.off("selectionUpdate", scrollCursorToCenter);
    };
  }, [editor]);

  // 에디터가 언마운트될 때 정리
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  // 에디터 준비 시 대기 중인 템플릿 적용
  useEffect(() => {
    if (editor && pendingTemplateRef.current) {
      const t = pendingTemplateRef.current;
      pendingTemplateRef.current = null;
      const html =
        t === "diagnosis" ? TEMPLATE_DIAGNOSIS_HTML : TEMPLATE_VERIFICATION_HTML;
      editor.commands.setContent(html);
    }
  }, [editor]);

  // 제목 textarea 높이 자동 조절 (초기 및 값 변경 시)
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, [formData.title]);

  // 작성 중 이탈 방지: 제목 또는 본문에 1글자라도 있으면 true
  const isDirty =
    formData.title.trim().length > 0 ||
    (editor ? !editor.isEmpty : ((formData.content || "").trim() !== "" && (formData.content || "").trim() !== "<p></p>"));

  const justSubmittedRef = useRef(false);

  // 변경 사항이 있는지 확인 (기존 헬퍼)
  const hasUnsavedChanges = () => {
    if (!editor) return false;
    return formData.title.trim() !== "" || !editor.isEmpty;
  };

  const handleTemplateConfirm = () => {
    setShowTemplateModal(false);
    if (selectedTemplate === "free") return;
    const html =
      selectedTemplate === "diagnosis"
        ? TEMPLATE_DIAGNOSIS_HTML
        : TEMPLATE_VERIFICATION_HTML;
    setFormData((prev) => ({ ...prev, content: html }));
    if (editor) {
      editor.commands.setContent(html);
    } else {
      pendingTemplateRef.current = selectedTemplate;
    }
  };

  const handleTemplateClose = () => {
    setShowTemplateModal(false);
    navigate("/");
  };

  // 확인 버튼 클릭 시 메인으로 이동
  const handleConfirmCancel = () => {
    setIsAlertOpen(false);
    navigate(-1);
  };

  // 브라우저 새로고침/닫기 방지 (F5)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !justSubmittedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // CustomEvent: 취소 버튼 클릭 시
  useEffect(() => {
    const handleCancelRequest = () => {
      if (isDirty) {
        const confirmed = window.confirm("작성 중인 내용이 있습니다. 정말 취소하시겠습니까?");
        if (confirmed) navigate(-1);
      } else {
        navigate(-1);
      }
    };
    window.addEventListener("request-cancel-write", handleCancelRequest);
    return () => window.removeEventListener("request-cancel-write", handleCancelRequest);
  }, [isDirty, navigate]);

  // CustomEvent: 앱 내 다른 페이지로 이동 시 (로고 등)
  useEffect(() => {
    const handleNavigateFromWrite = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string }>;
      const path = customEvent.detail?.path;
      if (path == null) return;
      if (justSubmittedRef.current) {
        navigate(path);
        return;
      }
      if (isDirty) {
        const confirmed = window.confirm("작성 중인 내용이 있습니다. 정말 취소하시겠습니까?");
        if (confirmed) navigate(path);
      } else {
        navigate(path);
      }
    };
    window.addEventListener("request-navigate-from-write", handleNavigateFromWrite);
    return () => window.removeEventListener("request-navigate-from-write", handleNavigateFromWrite);
  }, [isDirty, navigate]);

  // 상단 "발행하기" 버튼 클릭 시: 실제 저장 대신 발행 설정 모달 오픈
  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      openAuthModal();
      return;
    }

    if (!editor) return;

    const pureUserText = getFilteredPreviewText(formData.content);
    if (!formData.title.trim() || !pureUserText.trim()) {
      alert("제목과 내용을 모두 입력해주세요.");
      return;
    }

    setIsPublishSettingsOpen(true);
  };

  // 발행 설정 모달에서 실제 DB 저장 처리
  const handleConfirmPublish = async () => {
    if (!user || !editor) return;

    if (selectedCategories.length === 0) {
      toast.warning("주제를 최소 1개 이상 선택해주세요.", {
        position: "top-center",
        duration: 2000,
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const postPayload: any = {
        title: formData.title,
        content: editor.getHTML(),
        author_id: user.id,
        // 기존 is_public 로직 유지
        is_public: isPublic,
        // 신규 컬럼: scope ('public' | 'private')
        scope: isPublic ? "public" : "private",
        // 폴더: '선택 안 함' 체크 시 null, 아니면 드롭다운 선택값
        folder_id: isFolderNotSelected ? null : selectedFolderId,
        // 신규 컬럼: categories string[]
        categories: selectedCategories,
      };

      console.log("전송 데이터:", postPayload);

      const folderIdToUse = isFolderNotSelected ? null : selectedFolderId;

      if (editPostId) {
        const { error: updateError } = await supabase
          .from("posts")
          .update({
            title: postPayload.title,
            content: postPayload.content,
            is_public: postPayload.is_public,
            scope: postPayload.scope,
            folder_id: folderIdToUse,
            categories: postPayload.categories,
          })
          .eq("id", editPostId)
          .eq("author_id", user.id);

        if (updateError) throw updateError;

        if (folderIdToUse) {
          await supabase
            .from("folders")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", folderIdToUse);
        }

        setIsPublishSettingsOpen(false);
        justSubmittedRef.current = true;
        toast.success("수정되었습니다!", {
          position: "top-center",
          duration: 2000,
        });
        navigate(`/post/${editPostId}`, { replace: true });
      } else {
        const { data: insertedRow, error } = await supabase
          .from("posts")
          .insert([postPayload])
          .select()
          .single();

        if (error) throw error;

        if (folderIdToUse) {
          await supabase
            .from("folders")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", folderIdToUse);
        }

        setIsPublishSettingsOpen(false);
        justSubmittedRef.current = true;
        toast.success("발행되었습니다!", {
          position: "top-center",
          duration: 2000,
        });

        // profiles 테이블에서 작성자 정보 조회 (nickname, avatar_url)
        const { data: profileData } = await supabase
          .from("profiles")
          .select("nickname, avatar_url, bio, job_title")
          .eq("id", user.id)
          .single();

        const tempPostForFeed =
          insertedRow && user
            ? {
                id: insertedRow.id,
                title: insertedRow.title,
                content: insertedRow.content,
                author_id: insertedRow.author_id,
                author: {
                  id: user.id,
                  email: user.email ?? "",
                  nickname: profileData?.nickname ?? "나",
                  avatar_url: profileData?.avatar_url ?? "",
                  bio: profileData?.bio ?? "",
                  job_title: profileData?.job_title ?? "",
                },
                save_count: insertedRow.save_count ?? 0,
                comment_count: 0,
                like_count: 0,
                view_count: insertedRow.view_count ?? 0,
                created_at: insertedRow.created_at,
                is_public: insertedRow.is_public ?? true,
                categories: selectedCategories.length ? selectedCategories : null,
              }
            : null;

        navigate("/", { state: tempPostForFeed ? { tempPost: tempPostForFeed } : {} });
      }
    } catch (error: any) {
      console.error("저장 실패:", error);
      toast.error(`저장 실패: ${error.message || "알 수 없는 오류"}`, {
        position: "top-center",
        duration: 2000,
      });
    } finally {
    setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <TemplateSelectModal
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
        onConfirm={handleTemplateConfirm}
        onClose={handleTemplateClose}
      />

      <main className="max-w-4xl mx-auto my-12 relative">
        {isLoadingEditPost && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
            <p className="text-muted-foreground">게시물을 불러오는 중...</p>
          </div>
        )}
        <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
        <form id="write-form" onSubmit={handlePublish} className="space-y-8">
          {/* 제목 - PostDetail과 동일 (text-4xl) */}
          <div>
            <textarea
              ref={titleTextareaRef}
              placeholder="제목을 입력하세요"
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                if (titleTextareaRef.current) {
                  titleTextareaRef.current.style.height = "auto";
                  titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editor?.commands.focus();
                }
              }}
              className="w-full resize-none overflow-hidden text-4xl font-bold text-gray-900 bg-transparent outline-none focus:outline-none placeholder:text-gray-400 break-words font-sans"
              rows={1}
            />
          </div>

          {/* 내용 - Tiptap 에디터 (Medium 스타일) */}
          <div
            className="relative"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {editor ? (
              <div className="min-h-screen pb-[50vh] [&_.ProseMirror]:outline-none [&_.ProseMirror]:focus:outline-none">
                <EditorContent editor={editor} />
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-gray-400">에디터를 불러오는 중...</p>
              </div>
            )}
            {isUploading && (
              <p className="text-sm text-gray-400 mt-2 absolute bottom-4 left-0">
                이미지 업로드 중...
              </p>
            )}
          </div>
        </form>
        </article>

        {/* 발행 설정 모달 */}
        <Dialog open={isPublishSettingsOpen} onOpenChange={setIsPublishSettingsOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>발행 설정</DialogTitle>
              <DialogDescription>
                글을 어떻게 발행할지 마지막으로 설정해 주세요.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* 섹션 1: 공개 설정 */}
              <section className="space-y-2">
                <p className="text-sm font-medium text-gray-900">공개 설정</p>
                <div className="inline-flex rounded-lg bg-gray-100 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      isPublic
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    🌏 전체 공개
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      !isPublic
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    🔒 나만 보기
                  </button>
                </div>
              </section>

              {/* 섹션 2: 폴더 선택 (드롭다운 + 선택 안 함 체크박스) */}
              <section className="space-y-2">
                <p className="text-sm font-medium text-gray-900">저장할 폴더</p>
                <div className="flex flex-row items-center gap-3 w-full">
                  <div
                    className={`w-[200px] flex-none relative ${isFolderNotSelected ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <Popover open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
                      <PopoverTrigger
                        disabled={
                          isFolderNotSelected ||
                          isLoadingFolders ||
                          folders.length === 0
                        }
                        className="w-full rounded-md border border-input bg-background pl-3 pr-3 py-2 text-sm text-gray-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed flex items-center justify-between gap-2 min-w-0"
                      >
                        <span className="min-w-0 flex-1 truncate text-left">
                          {isLoadingFolders
                            ? "폴더 불러오는 중..."
                            : folders.length === 0
                              ? "폴더를 생성해주세요"
                              : selectedFolderId
                                ? folders.find((f) => f.id === selectedFolderId)?.name ?? "폴더 선택"
                                : "폴더 선택"}
                        </span>
                        <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,20rem)] p-0" align="start">
                        <div className="max-h-60 overflow-auto min-w-0">
                          {folders.map((folder) => (
                            <button
                              key={folder.id}
                              type="button"
                              onClick={() => {
                                setSelectedFolderId(folder.id);
                                setFolderPopoverOpen(false);
                              }}
                              className="w-full min-w-0 max-w-full px-3 py-2 text-sm text-left hover:bg-accent focus:bg-accent focus:outline-none cursor-pointer"
                            >
                              <span className="block min-w-0 truncate">{folder.name}</span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {folders.length >= 1 && (
                    <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
                      <Checkbox
                        checked={isFolderNotSelected}
                        onCheckedChange={(checked) => {
                          const next = checked === true;
                          setIsFolderNotSelected(next);
                          if (next) setSelectedFolderId(null);
                        }}
                      />
                      <span className="text-sm text-gray-700">선택 안 함</span>
                    </label>
                  )}
                </div>
              </section>

              {/* 섹션 3: 카테고리 선택 */}
              <section className="space-y-2">
                <div className="flex items-baseline justify-start gap-2">
                  <p className="text-sm font-medium text-gray-900">주제 선택</p>
                  <p className="text-xs text-gray-400">5개까지 선택 가능</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_TAGS.map((tag) => {
                    const isSelected = selectedCategories.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSelectedCategories((prev) => {
                            const exists = prev.includes(tag);
                            if (exists) {
                              return prev.filter((t) => t !== tag);
                            }
                            if (prev.length >= 5) {
                              toast.warning(
                                "주제는 최대 5개까지 선택할 수 있어요.",
                                {
                                  position: "top-center",
                                  duration: 2000,
                                }
                              );
                              return prev;
                            }
                            return [...prev, tag];
                          });
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </section>
              </div>

            <DialogFooter className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                onClick={() => setIsPublishSettingsOpen(false)}
                disabled={isSubmitting}
                >
                취소
                </Button>
              <Button
                type="button"
                onClick={handleConfirmPublish}
                disabled={isSubmitting || selectedCategories.length === 0}
                className="bg-gray-900 hover:bg-gray-800 text-white"
              >
                {isSubmitting ? (editPostId ? "수정 중..." : "발행 중...") : (editPostId ? "수정하기" : "발행하기")}
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      {/* 작성 취소 확인 다이얼로그 */}
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작성을 취소하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              작성 중인 내용은 저장되지 않습니다. 정말 나가시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 작성</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WritePage;
