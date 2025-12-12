import React, { useState, useCallback, useEffect } from 'react';
import { UploadZone } from './components/UploadZone';
import { PresetSelector } from './components/PresetSelector';
import { Button } from './components/Button';
import { ImageCropper } from './components/ImageCropper';
import { PRESETS, DEFAULT_LIFESTYLE_PROMPT } from './constants';
import { Preset, ProcessingState, SourceImage, IMAGE_LABELS, PresetType, ProcessedImage, AVAILABLE_ANGLES, SavedStyle } from './types';
import { processImagesWithGemini, upscaleImage } from './services/geminiService';
import { fetchSharedStyles, publishSharedStyle, deleteSharedStyle, type SharedStyle } from './services/styleService';
import { fetchSharedPrompts, publishSharedPrompt, deleteSharedPrompt, type SharedPrompt } from './services/promptService';
import { Download, X, AlertCircle, Wand2, Plus, ZoomIn, Maximize2, ChevronLeft, ChevronRight, Crop, Save, Trash2, LayoutTemplate, RotateCw, Settings2, Check, ArrowUpCircle, Info, Loader2, Key, ImagePlus, Ratio, Sun, Home, AlignLeft, FileType, Library, ArrowDownAZ, Calendar, Grid } from 'lucide-react';

interface SavedPrompt {
    name: string;
    text: string;
    referenceImage?: string; // Base64 string of reference image (optional)
}

type ExportFormat = 'png' | 'jpg' | 'webp';
type SortOption = 'newest' | 'oldest' | 'az';

const App: React.FC = () => {
    const [sourceImages, setSourceImages] = useState<SourceImage[]>([]);
    const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
    const [customPrompt, setCustomPrompt] = useState<string>('');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [isDraggingRef, setIsDraggingRef] = useState(false);
    const [selectedAngles, setSelectedAngles] = useState<string[]>(["Front View", "Side View", "3/4 Perspective View"]);
    const [bodyType, setBodyType] = useState<string>('Men');

    // Lifestyle Specific State
    const [lifestyleRatio, setLifestyleRatio] = useState<string>('3:4'); // Storing ratio family (e.g. '4:3', '16:9', '1:1')
    const [isPortrait, setIsPortrait] = useState<boolean>(true);
    const [lifestyleEnv, setLifestyleEnv] = useState<string>('Outdoor');
    const [lifestyleContext, setLifestyleContext] = useState<string>('');

    // Preset Saving State
    const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
    const [promptToDelete, setPromptToDelete] = useState<number | null>(null);
    const [isNamingPreset, setIsNamingPreset] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    // Style Library State
    const [savedStyles, setSavedStyles] = useState<SavedStyle[]>([]);
    const [sharedStyles, setSharedStyles] = useState<SharedStyle[]>([]);
    const [activeLibraryTab, setActiveLibraryTab] = useState<'local' | 'shared'>('local');
    const [isPublishing, setIsPublishing] = useState(false);

    // Shared Prompts State
    const [sharedPrompts, setSharedPrompts] = useState<SharedPrompt[]>([]);
    const [activePromptTab, setActivePromptTab] = useState<'local' | 'shared'>('local');

    const [styleSort, setStyleSort] = useState<SortOption>('newest');
    const [isNamingStyle, setIsNamingStyle] = useState(false);
    const [newStyleName, setNewStyleName] = useState('');
    const [styleToDelete, setStyleToDelete] = useState<string | null>(null);

    const [imageQuality, setImageQuality] = useState<'1K' | '2K' | '4K'>('1K');
    const [exportFormat, setExportFormat] = useState<ExportFormat>('png');

    const [processingState, setProcessingState] = useState<ProcessingState>({
        isProcessing: false,
        statusMessage: '',
        error: null,
        processedImages: [],
    });

    const [upscalingIndex, setUpscalingIndex] = useState<{ index: number, resolution: string } | null>(null);

    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [apiKey, setApiKey] = useState<string>('');
    const [showKeyInput, setShowKeyInput] = useState(false);

    const [imageToCrop, setImageToCrop] = useState<{ type: 'source' | 'result'; url: string; index: number } | null>(null);

    useEffect(() => {
        const storedKey = localStorage.getItem('nanoStudio_apiKey');
        if (storedKey) setApiKey(storedKey);
    }, []);

    const saveApiKey = (key: string) => {
        setApiKey(key);
        localStorage.setItem('nanoStudio_apiKey', key);
        setShowKeyInput(false);
    };

    useEffect(() => {
        const saved = localStorage.getItem('nanoStudio_prompts_v2');
        if (saved) {
            try {
                setSavedPrompts(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved prompts");
            }
        }

        const savedStylesLocal = localStorage.getItem('nanoStudio_styles');
        if (savedStylesLocal) {
            try {
                setSavedStyles(JSON.parse(savedStylesLocal));
            } catch (e) {
                console.error("Failed to parse saved styles");
            }
        }

        const savedFormat = localStorage.getItem('nanoStudio_exportFormat');
        if (savedFormat && ['png', 'jpg', 'webp'].includes(savedFormat)) {
            setExportFormat(savedFormat as ExportFormat);
        }
    }, []);

    const handleFormatChange = (fmt: ExportFormat) => {
        setExportFormat(fmt);
        localStorage.setItem('nanoStudio_exportFormat', fmt);
    };

    // Update prompt when preset changes
    useEffect(() => {
        if (selectedPreset) {
            setCustomPrompt(selectedPreset.promptTemplate);
            // Reset lifestyle context when switching presets
            setLifestyleContext('');
        }
    }, [selectedPreset?.id]);

    // -- Shared Styles Logic --


    // Helper to load shared styles
    const loadSharedStyles = async () => {
        if (activeLibraryTab === 'shared') {
            const styles = await fetchSharedStyles();
            setSharedStyles(styles);
        }
    };

    useEffect(() => {
        loadSharedStyles();
    }, [activeLibraryTab]);

    // Load Shared Prompts
    useEffect(() => {
        const loadSharedPrompts = async () => {
            if (activePromptTab === 'shared') {
                const prompts = await fetchSharedPrompts();
                setSharedPrompts(prompts);
            }
        };
        loadSharedPrompts();
    }, [activePromptTab]);

    // ... (rest of local storage effect)

    const handlePublishPrompt = async () => {
        if (!newPresetName.trim() || !customPrompt.trim()) return;
        setIsPublishing(true);
        try {
            await publishSharedPrompt(newPresetName.trim(), customPrompt.trim());

            setNewPresetName('');
            setIsNamingPreset(false);
            if (activePromptTab === 'shared') {
                const prompts = await fetchSharedPrompts();
                setSharedPrompts(prompts);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to publish prompt.");
        } finally {
            setIsPublishing(false);
        }
    };

    const handleDeleteSharedPrompt = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Delete this shared prompt?")) {
            await deleteSharedPrompt(id);
            const prompts = await fetchSharedPrompts();
            setSharedPrompts(prompts);
        }
    };

    const handlePublishStyle = async () => {
        if (!referenceImage || !newStyleName.trim()) return;
        setIsPublishing(true);
        try {
            const compressed = await resizeForStorage(referenceImage);
            await publishSharedStyle(newStyleName.trim(), customPrompt, compressed);
            await loadSharedStyles();
            setIsNamingStyle(false);
            setNewStyleName('');
            setActiveLibraryTab('shared');
        } catch (e) {
            alert("Failed to publish style.");
        } finally {
            setIsPublishing(false);
        }
    };

    const handleDeleteShared = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this shared style?")) {
            await deleteSharedStyle(id);
            loadSharedStyles();
        }
    };



    // Helper to resize image before saving to LocalStorage to avoid quota limits
    const resizeForStorage = (base64Str: string, maxWidth = 400, quality = 0.8): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxWidth) {
                    const ratio = width / height;
                    if (ratio > 1) {
                        width = maxWidth;
                        height = Math.round(maxWidth / ratio);
                    } else {
                        height = maxWidth;
                        width = Math.round(maxWidth * ratio);
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => resolve(base64Str); // Fallback
        });
    };

    // --- Style Library Functions ---
    const saveCurrentStyle = async () => {
        if (!referenceImage || !newStyleName.trim()) return;

        try {
            const compressedImage = await resizeForStorage(referenceImage);
            const newStyle: SavedStyle = {
                id: Date.now().toString(),
                name: newStyleName.trim(),
                imageData: compressedImage,
                timestamp: Date.now()
            };

            const updated = [newStyle, ...savedStyles];
            setSavedStyles(updated);
            localStorage.setItem('nanoStudio_styles', JSON.stringify(updated));
            setIsNamingStyle(false);
            setNewStyleName('');
        } catch (e) {
            alert("Storage Limit Reached. Please delete some old styles.");
        }
    };

    const deleteStyle = (id: string) => {
        if (styleToDelete === id) {
            const updated = savedStyles.filter(s => s.id !== id);
            setSavedStyles(updated);
            localStorage.setItem('nanoStudio_styles', JSON.stringify(updated));
            setStyleToDelete(null);
        } else {
            setStyleToDelete(id);
            setTimeout(() => setStyleToDelete(null), 3000);
        }
    };

    const getSortedStyles = () => {
        return [...savedStyles].sort((a, b) => {
            if (styleSort === 'newest') return b.timestamp - a.timestamp;
            if (styleSort === 'oldest') return a.timestamp - b.timestamp;
            if (styleSort === 'az') return a.name.localeCompare(b.name);
            return 0;
        });
    };

    const initiateSave = () => {
        if (!customPrompt.trim() && !referenceImage) return;
        if (savedPrompts.some(p => p.text === customPrompt.trim() && p.referenceImage === referenceImage)) {
            alert("This exact preset is already saved.");
            return;
        }
        setNewPresetName("My Custom Style");
        setIsNamingPreset(true);
    };

    const confirmSave = async () => {
        if (!newPresetName.trim()) return;

        try {
            let savedRefImage = undefined;
            if (referenceImage) {
                savedRefImage = await resizeForStorage(referenceImage);
            }

            const newPrompts = [...savedPrompts, {
                name: newPresetName.trim(),
                text: customPrompt.trim(),
                referenceImage: savedRefImage
            }];

            setSavedPrompts(newPrompts);
            localStorage.setItem('nanoStudio_prompts_v2', JSON.stringify(newPrompts));

            setIsNamingPreset(false);
            setNewPresetName('');
        } catch (e) {
            alert("Storage full! Please delete some old presets to save new ones.");
        }
    };

    const cancelSave = () => {
        setIsNamingPreset(false);
        setNewPresetName('');
    };

    const deletePrompt = (index: number) => {
        if (promptToDelete === index) {
            const newPrompts = savedPrompts.filter((_, i) => i !== index);
            setSavedPrompts(newPrompts);
            localStorage.setItem('nanoStudio_prompts_v2', JSON.stringify(newPrompts));
            setPromptToDelete(null);
        } else {
            setPromptToDelete(index);
            setTimeout(() => setPromptToDelete(null), 3000);
        }
    };

    const handleFileSelect = (files: File[]) => {
        setProcessingState({ isProcessing: false, error: null, processedImages: [] });

        const newImages = files.map((file, index) => {
            // Determine label based on existing count
            // 1st image (overall index 0) = Front
            // 2nd image (overall index 1) = Back
            // Others = Other
            const totalIndex = sourceImages.length + index;
            let defaultLabel = 'Other';
            if (totalIndex === 0) defaultLabel = 'Front View';
            else if (totalIndex === 1) defaultLabel = 'Back View';

            const preview = URL.createObjectURL(file);

            return {
                id: Math.random().toString(36).substr(2, 9),
                file: file,
                originalFile: file, // Store original
                preview: preview,
                originalPreview: preview, // Store original preview
                label: defaultLabel
            };
        });

        setSourceImages(prev => [...prev, ...newImages]);
    };

    const processReferenceFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                setReferenceImage(ev.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processReferenceFile(e.target.files[0]);
        }
    };

    const handleRefPaste = (e: React.ClipboardEvent) => {
        e.stopPropagation(); // Stop bubbling to sidebar
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            const files = Array.from(e.clipboardData.files).filter((f) => (f as File).type.startsWith('image/')) as File[];
            if (files.length > 0) {
                e.preventDefault();
                processReferenceFile(files[0]);
            }
        }
    };

    const handleRefDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingRef(true);
    };

    const handleRefDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingRef(false);
    };

    const handleRefDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingRef(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                processReferenceFile(file);
            }
        }
    };

    const dataURLtoFile = (dataurl: string, filename: string): File => {
        const arr = dataurl.split(',');
        const match = arr[0].match(/:(.*?);/);
        const mime = match ? match[1] : 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

    const handleSidebarDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).filter((f) => (f as File).type.startsWith('image/')) as File[];
            if (files.length > 0) {
                handleFileSelect(files);
            }
            return;
        }
        const droppedUrl = e.dataTransfer.getData('text/plain');
        if (droppedUrl && droppedUrl.startsWith('data:image')) {
            const file = dataURLtoFile(droppedUrl, `edited-version-${Date.now()}.png`);
            handleFileSelect([file]);
        }
    };

    const handleSidebarPaste = (e: React.ClipboardEvent) => {
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            const files = Array.from(e.clipboardData.files).filter((f) => (f as File).type.startsWith('image/')) as File[];
            if (files.length > 0) {
                e.preventDefault();
                handleFileSelect(files);
            }
        }
    };

    const handleRemoveImage = (id: string) => {
        setSourceImages(prev => prev.filter(img => img.id !== id));
        if (sourceImages.length <= 1) {
            handleClear();
        }
    };

    const handleLabelChange = (id: string, newLabel: string) => {
        setSourceImages(prev => prev.map(img =>
            img.id === id ? { ...img, label: newLabel } : img
        ));
    };

    const toggleAngle = (angle: string) => {
        setSelectedAngles(prev =>
            prev.includes(angle) ? prev.filter(a => a !== angle) : [...prev, angle]
        );
    };

    const handleClear = () => {
        setSourceImages([]);
        setProcessingState({ isProcessing: false, error: null, processedImages: [] });
        setCustomPrompt('');
        setSelectedPreset(null);
        setReferenceImage(null);
        setLifestyleContext('');
    };

    const handleProcess = async () => {
        if (!apiKey) {
            setShowKeyInput(true);
            return;
        }
        if (sourceImages.length === 0 || !selectedPreset) return;

        setProcessingState({ ...processingState, isProcessing: true, statusMessage: 'Initializing...', error: null });

        // Calculate Aspect Ratio string for API
        let targetAspectRatio = '1:1';
        if (selectedPreset.id === PresetType.LIFESTYLE) {
            if (lifestyleRatio === '1:1') {
                targetAspectRatio = '1:1';
            } else if (lifestyleRatio === '4:3') {
                targetAspectRatio = isPortrait ? '3:4' : '4:3';
            } else if (lifestyleRatio === '16:9') {
                targetAspectRatio = isPortrait ? '9:16' : '16:9';
            }
        }

        try {
            const updateStatus = (msg: string) => {
                setProcessingState(prev => ({ ...prev, statusMessage: msg }));
            };

            const results = await processImagesWithGemini(
                sourceImages,
                selectedPreset.id,
                customPrompt,
                apiKey,
                imageQuality,
                updateStatus,
                referenceImage,
                selectedAngles,
                bodyType,
                targetAspectRatio,
                lifestyleEnv,
                lifestyleContext
            );

            setProcessingState({
                isProcessing: false,
                statusMessage: 'Done!',
                error: null,
                processedImages: results
            });

        } catch (err: any) {
            const msg = err.message || '';
            if (msg.includes('Requested entity was not found') || msg.includes('403') || msg.includes('API key')) {
                setApiKey('');
                setShowKeyInput(true);
                setProcessingState({
                    isProcessing: false,
                    error: "API Key invalid or session expired. Please select a key again.",
                    processedImages: []
                });
                return;
            }

            setProcessingState({
                isProcessing: false,
                error: msg || "An unexpected error occurred",
                processedImages: []
            });
        }
    };

    const handleUpscale = async (processedImg: ProcessedImage, index: number, resolution: '2K' | '4K') => {
        if (!apiKey) {
            setShowKeyInput(true);
            return;
        }

        setUpscalingIndex({ index, resolution });
        try {
            const upscaledUrl = await upscaleImage(processedImg.url, resolution, apiKey, (msg) => {
                console.log(msg);
            });

            const newImages = [...processingState.processedImages];
            newImages[index] = {
                ...processedImg,
                url: upscaledUrl
            };

            setProcessingState(prev => ({
                ...prev,
                processedImages: newImages
            }));
        } catch (err) {
            console.error("Upscale failed", err);
            alert("Upscaling failed. Please try again.");
        } finally {
            setUpscalingIndex(null);
        }
    };

    const convertAndDownloadImage = (imgUrl: string, filename: string, format: ExportFormat) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imgUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // If converting to JPG, fill background with white as it doesn't support transparency
            if (format === 'jpg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.drawImage(img, 0, 0);

            let mimeType = 'image/png';
            if (format === 'jpg') mimeType = 'image/jpeg';
            if (format === 'webp') mimeType = 'image/webp';

            const dataUrl = canvas.toDataURL(mimeType, 0.9); // 0.9 quality

            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${filename}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        img.onerror = () => {
            // Fallback if CORS or other issue prevents canvas manipulation
            const link = document.createElement('a');
            link.href = imgUrl;
            link.download = `${filename}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    };

    const handleDownload = (img: ProcessedImage, index: number) => {
        const filename = `${img.filename}-${index + 1}`;
        convertAndDownloadImage(img.url, filename, exportFormat);
    };

    const handleSaveCrop = (croppedUrl: string) => {
        if (!imageToCrop) return;

        if (imageToCrop.type === 'result') {
            const newImages = [...processingState.processedImages];
            newImages[imageToCrop.index] = {
                ...newImages[imageToCrop.index],
                url: croppedUrl
            };
            setProcessingState(prev => ({
                ...prev,
                processedImages: newImages
            }));
        } else {
            const originalImage = sourceImages[imageToCrop.index];
            const newFile = dataURLtoFile(croppedUrl, originalImage.originalFile.name);

            const newSourceImages = [...sourceImages];
            newSourceImages[imageToCrop.index] = {
                ...originalImage,
                file: newFile,
                preview: croppedUrl
            };
            setSourceImages(newSourceImages);
        }

        setImageToCrop(null);
    };

    const getResultLabel = (index: number) => {
        if (selectedPreset?.id === PresetType.ANGLES) {
            if (index < selectedAngles.length) {
                return selectedAngles[index];
            }
            return `View ${index + 1}`;
        }
        if (sourceImages.length > 1 && processingState.processedImages.length === sourceImages.length) {
            return `${sourceImages[index]?.label} (Processed)`;
        }
        return 'Enhanced Result';
    };

    const nextImage = useCallback(() => {
        setLightboxIndex(prev => {
            if (prev === null) return null;
            return prev < processingState.processedImages.length - 1 ? prev + 1 : 0;
        });
    }, [processingState.processedImages.length]);

    const prevImage = useCallback(() => {
        setLightboxIndex(prev => {
            if (prev === null) return null;
            return prev > 0 ? prev - 1 : processingState.processedImages.length - 1;
        });
    }, [processingState.processedImages.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (lightboxIndex === null) return;
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
            if (e.key === 'Escape') setLightboxIndex(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxIndex, nextImage, prevImage]);

    // Derive targetAspectRatio for display
    const targetAspectRatio = (() => {
        if (selectedPreset?.id === PresetType.GHOST_MANNEQUIN || selectedPreset?.id === PresetType.ANGLES) {
            return '3:4';
        }
        if (selectedPreset?.id === PresetType.LIFESTYLE) {
            if (lifestyleRatio === '1:1') return '1:1';
            if (lifestyleRatio === '4:3') return isPortrait ? '3:4' : '4:3';
            if (lifestyleRatio === '16:9') return isPortrait ? '9:16' : '16:9';
        }
        return '1:1';
    })();

    if (!apiKey) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
                    <div className="bg-gradient-to-tr from-yellow-400 to-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-orange-200">
                        <Wand2 size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Nano Studio Pro</h1>
                    <p className="text-slate-500 mb-6">Enter your Gemini API Key to continue.</p>

                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const input = form.elements.namedItem('key') as HTMLInputElement;
                        if (input.value.trim()) saveApiKey(input.value.trim());
                    }}>
                        <input
                            name="key"
                            type="password"
                            placeholder="Enter Google Gemini API Key"
                            className="w-full mb-4 px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            autoFocus
                        />
                        <Button className="w-full h-12 text-lg">
                            Start Creating
                        </Button>
                    </form>
                    <p className="mt-4 text-xs text-slate-400">
                        Key is saved locally in your browser.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden">

            {imageToCrop && (
                <ImageCropper
                    imageSrc={imageToCrop.url}
                    onCancel={() => setImageToCrop(null)}
                    onSave={handleSaveCrop}
                />
            )}

            {lightboxIndex !== null && processingState.processedImages[lightboxIndex] && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setLightboxIndex(null)}
                >
                    <button
                        className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all z-50"
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxIndex(null);
                        }}
                    >
                        <X size={32} />
                    </button>
                    <img
                        src={processingState.processedImages[lightboxIndex].url}
                        alt="Full Preview"
                        className="max-w-full max-h-full object-contain rounded-sm shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            <header className="bg-white border-b border-slate-200 px-6 py-3 flex-shrink-0 z-20">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-yellow-400 to-orange-500 p-2 rounded-lg text-white shadow-sm">
                            <Wand2 size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">Nano Studio Pro</h1>
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">AI Product Photography</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setApiKey('')}
                            className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                            title="Change API Key"
                        >
                            <Key size={14} />
                            <span className="hidden sm:inline">Change Key</span>
                        </button>

                        <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                            <span className="px-2 text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <FileType size={12} /> Format
                            </span>
                            <div className="h-4 w-px bg-slate-300 mx-1"></div>
                            {['png', 'jpg', 'webp'].map((fmt) => (
                                <button
                                    key={fmt}
                                    onClick={() => handleFormatChange(fmt as ExportFormat)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all uppercase ${exportFormat === fmt ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    {fmt}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                            <span className="px-2 text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Settings2 size={12} /> Quality
                            </span>
                            <div className="h-4 w-px bg-slate-300 mx-1"></div>
                            <button
                                onClick={() => setImageQuality('1K')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${imageQuality === '1K' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Fast (1K)
                            </button>
                            <button
                                onClick={() => setImageQuality('2K')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${imageQuality === '2K' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                High (2K)
                            </button>
                            <button
                                onClick={() => setImageQuality('4K')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${imageQuality === '4K' ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Ultra (4K)
                            </button>
                        </div>

                        {sourceImages.length > 0 && (
                            <Button variant="ghost" onClick={handleClear} size="sm" className="text-slate-500 hover:text-red-600">
                                Start Over
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden max-w-[1600px] mx-auto w-full">

                {sourceImages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300">
                        <div className="max-w-xl w-full text-center">
                            <h2 className="text-4xl font-extrabold text-slate-900 mb-6 tracking-tight">Studio Quality.<br />Instantly.</h2>
                            <p className="text-lg text-slate-500 mb-10 leading-relaxed">
                                Upload your raw product photos and let Gemini 3 Pro transform them into professional assets. Ghost mannequins, lifestyle shots, and more.
                            </p>
                            <UploadZone onFileSelect={handleFileSelect} className="h-72 bg-white shadow-xl shadow-slate-200/50 border-slate-200" />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="w-[420px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleSidebarDrop}
                                onPaste={handleSidebarPaste}
                                tabIndex={0}
                                style={{ outline: 'none' }}
                            >
                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Input Images ({sourceImages.length})</h3>
                                        <label className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer flex items-center gap-1">
                                            <Plus size={14} /> Add
                                            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => e.target.files && handleFileSelect(Array.from(e.target.files))} />
                                        </label>
                                    </div>
                                    <div className="space-y-3">
                                        {sourceImages.map((img, idx) => (
                                            <div key={img.id} className="group flex gap-3 items-center p-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors">
                                                <div
                                                    className="w-12 h-12 bg-white rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 cursor-zoom-in relative"
                                                    onClick={() => window.open(img.preview, '_blank')}
                                                >
                                                    <img src={img.preview} className="w-full h-full object-cover" alt="thumb" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <select
                                                        className="w-full text-xs font-medium bg-transparent border-none p-0 text-slate-700 focus:ring-0 cursor-pointer hover:text-blue-600"
                                                        value={img.label}
                                                        onChange={(e) => handleLabelChange(img.id, e.target.value)}
                                                    >
                                                        {IMAGE_LABELS.map(label => (
                                                            <option key={label} value={label}>{label}</option>
                                                        ))}
                                                    </select>
                                                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{img.file.name}</p>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <button
                                                        onClick={() => setImageToCrop({ type: 'source', url: img.originalPreview, index: idx })}
                                                        className="text-slate-300 hover:text-blue-600 p-1 mb-1 transition-colors"
                                                        title="Crop Source Image"
                                                    >
                                                        <Crop size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveImage(img.id)}
                                                        className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Transformation</h3>
                                    <PresetSelector
                                        presets={PRESETS}
                                        selectedId={selectedPreset?.id || null}
                                        onSelect={setSelectedPreset}
                                        disabled={processingState.isProcessing}
                                    />
                                </section>

                                {selectedPreset && (
                                    <section className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-4">

                                        {/* Style Reference (Hidden for BG_REMOVE_REPAIR) */}
                                        {selectedPreset.id !== PresetType.BG_REMOVE_REPAIR && (
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Style Reference (Optional)</h3>
                                                    </div>

                                                    {referenceImage ? (
                                                        <div className="relative group rounded-xl overflow-hidden border border-blue-200 shadow-sm w-full h-32 bg-slate-50 pattern-checkered">
                                                            <img src={referenceImage} alt="Reference" className="w-full h-full object-contain" />
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                {!isNamingStyle && (
                                                                    <button
                                                                        onClick={() => setIsNamingStyle(true)}
                                                                        className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors"
                                                                        title="Save to Library"
                                                                    >
                                                                        <Save size={18} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => setReferenceImage(null)}
                                                                    className="bg-white text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                                                                    title="Remove"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                            <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">REF</div>

                                                            {/* Name input overlay */}
                                                            {isNamingStyle && (
                                                                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-4">
                                                                    <span className="text-xs font-bold text-slate-600 mb-2">Name this Style</span>
                                                                    <div className="flex w-full gap-2 mb-2">
                                                                        <input
                                                                            autoFocus
                                                                            type="text"
                                                                            className="flex-1 text-xs border border-blue-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                                                                            placeholder="e.g. Neon Studio"
                                                                            value={newStyleName}
                                                                            onChange={(e) => setNewStyleName(e.target.value)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && (isPublishing ? handlePublishStyle() : saveCurrentStyle())}
                                                                        />
                                                                        <button onClick={() => isPublishing ? handlePublishStyle() : saveCurrentStyle()} className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700">
                                                                            {isPublishing ? <div className="animate-spin"><Loader2 size={14} /></div> : <Check size={14} />}
                                                                        </button>
                                                                        <button onClick={() => { setIsNamingStyle(false); setNewStyleName(''); }} className="bg-slate-200 text-slate-600 p-1 rounded hover:bg-slate-300"><X size={14} /></button>
                                                                    </div>

                                                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isPublishing}
                                                                            onChange={(e) => setIsPublishing(e.target.checked)}
                                                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                                                                        />
                                                                        <span className="text-[10px] text-slate-500 font-medium">Publish to Community</span>
                                                                    </label>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <label
                                                            className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 outline-none
                                        ${isDraggingRef
                                                                    ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                                                                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 focus:border-blue-400 focus:bg-slate-50'}`}
                                                            onDragOver={handleRefDragOver}
                                                            onDragLeave={handleRefDragLeave}
                                                            onDrop={handleRefDrop}
                                                            onPaste={handleRefPaste}
                                                            tabIndex={0}
                                                        >
                                                            <div className={`flex flex-col items-center gap-1 transition-colors ${isDraggingRef ? 'text-blue-600' : 'text-slate-400'}`}>
                                                                {isDraggingRef ? <Plus size={24} /> : <ImagePlus size={20} />}
                                                                <span className="text-xs font-medium text-center px-4">{isDraggingRef ? 'Drop Reference Here' : 'Drag, Paste or Click to Add Reference'}</span>
                                                            </div>
                                                            <input type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
                                                        </label>
                                                    )}
                                                </div>

                                                {/* Style Library Section */}
                                                <div className="border-t border-slate-100 pt-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="font-medium text-slate-800 flex items-center gap-2">
                                                                <Library size={18} className="text-blue-600" />
                                                                Style Library
                                                            </h3>
                                                            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                                                <button
                                                                    onClick={() => setActiveLibraryTab('local')}
                                                                    className={`flex-1 text-xs font-medium px-2 py-1 rounded-md transition-all ${activeLibraryTab === 'local'
                                                                        ? 'bg-white text-slate-900 shadow-sm'
                                                                        : 'text-slate-500 hover:text-slate-700'
                                                                        }`}
                                                                >
                                                                    My Styles ({savedStyles.length})
                                                                </button>
                                                                <button
                                                                    onClick={() => setActiveLibraryTab('shared')}
                                                                    className={`flex-1 text-xs font-medium px-2 py-1 rounded-md transition-all ${activeLibraryTab === 'shared'
                                                                        ? 'bg-white text-blue-600 shadow-sm'
                                                                        : 'text-slate-500 hover:text-slate-700'
                                                                        }`}
                                                                >
                                                                    Shared ({sharedStyles.length})
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="flex bg-slate-100 rounded p-0.5">
                                                            <button onClick={() => setStyleSort('newest')} className={`p-1 rounded ${styleSort === 'newest' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`} title="Newest"><Calendar size={12} /></button>
                                                            <button onClick={() => setStyleSort('oldest')} className={`p-1 rounded ${styleSort === 'oldest' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`} title="Oldest"><RotateCw size={12} className="rotate-180" /></button>
                                                            <button onClick={() => setStyleSort('az')} className={`p-1 rounded ${styleSort === 'az' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`} title="A-Z"><ArrowDownAZ size={12} /></button>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3 overflow-y-auto max-h-[400px] pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                                        {activeLibraryTab === 'local' ? (
                                                            savedStyles.length === 0 ? (
                                                                <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                                                    <Grid size={20} className="mx-auto text-slate-300 mb-1" />
                                                                    <p className="text-[10px] text-slate-400">Save your favorite styles here.</p>
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {getSortedStyles().map((style) => (
                                                                        <div
                                                                            key={style.id}
                                                                            className="relative group aspect-square rounded-lg border border-slate-200 bg-white overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                                                                            onClick={() => {
                                                                                setReferenceImage(style.imageData);
                                                                                if (style.prompt) setCustomPrompt(style.prompt);
                                                                            }}
                                                                        >
                                                                            <img src={style.imageData} alt={style.name} className="w-full h-full object-cover" />
                                                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4">
                                                                                <p className="text-[9px] text-white font-medium truncate leading-tight">{style.name}</p>
                                                                            </div>

                                                                            {/* Delete Confirm Overlay */}
                                                                            {styleToDelete === style.id ? (
                                                                                <div
                                                                                    className="absolute inset-0 bg-red-500/90 flex flex-col items-center justify-center p-1 text-center animate-in fade-in duration-200"
                                                                                    onClick={(e) => { e.stopPropagation(); deleteStyle(style.id); }}
                                                                                >
                                                                                    <Trash2 size={16} className="text-white mb-1" />
                                                                                    <span className="text-[8px] text-white font-bold uppercase">Confirm</span>
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    className="absolute top-1 right-1 p-1 bg-black/20 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-all"
                                                                                    onClick={(e) => { e.stopPropagation(); deleteStyle(style.id); }}
                                                                                >
                                                                                    <X size={10} />
                                                                                </button>
                                                                            )}

                                                                            {/* Active Indicator */}
                                                                            {referenceImage === style.imageData && (
                                                                                <div className="absolute top-1 left-1 w-2 h-2 bg-green-500 rounded-full border border-white shadow-sm"></div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )
                                                        ) : (
                                                            // SHARED STYLES LIST
                                                            sharedStyles.length === 0 ? (
                                                                <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                                                    <Grid size={20} className="mx-auto text-slate-300 mb-1" />
                                                                    <p className="text-[10px] text-slate-400">No shared styles yet.</p>
                                                                    <p className="text-[9px] text-slate-400">Be the first to share one!</p>
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {sharedStyles.map((style) => (
                                                                        <div
                                                                            key={style.id}
                                                                            className="relative group aspect-square rounded-lg border border-slate-200 bg-white overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                                                                            onClick={() => {
                                                                                setReferenceImage(style.imageUrl);
                                                                                if (style.prompt) setCustomPrompt(style.prompt);
                                                                            }}
                                                                        >
                                                                            <img src={style.imageUrl} alt={style.name} className="w-full h-full object-cover" />
                                                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4">
                                                                                <p className="text-[9px] text-white font-medium truncate leading-tight">{style.name}</p>
                                                                            </div>

                                                                            <button
                                                                                onClick={(e) => handleDeleteShared(style.id, e)}
                                                                                className="absolute top-1 right-1 p-1 bg-black/20 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-all"
                                                                            >
                                                                                <Trash2 size={10} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {/* LIFESTYLE Specific Controls */}
                                        {selectedPreset.id === PresetType.LIFESTYLE && (
                                            <div className="mb-4 space-y-4">
                                                {/* Environment & Orientation Row */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Environment</h3>
                                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                                            {['Outdoor', 'Indoor'].map(env => (
                                                                <button
                                                                    key={env}
                                                                    onClick={() => setLifestyleEnv(env)}
                                                                    className={`flex-1 text-[10px] font-bold py-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${lifestyleEnv === env ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                                                                >
                                                                    {env === 'Outdoor' ? <Sun size={12} /> : <Home size={12} />}
                                                                    {env}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Orientation</h3>
                                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                                            <button
                                                                onClick={() => setIsPortrait(true)}
                                                                className={`flex-1 text-[10px] font-bold py-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${isPortrait ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                                                            >
                                                                <div className="w-2 h-3 border border-current rounded-sm"></div>
                                                                Port.
                                                            </button>
                                                            <button
                                                                onClick={() => setIsPortrait(false)}
                                                                className={`flex-1 text-[10px] font-bold py-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${!isPortrait ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                                                            >
                                                                <div className="w-3 h-2 border border-current rounded-sm"></div>
                                                                Land.
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Ratio Selection */}
                                                <div>
                                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Aspect Ratio</h3>
                                                    <div className="flex gap-2">
                                                        {['1:1', '4:3', '16:9'].map(ratio => (
                                                            <button
                                                                key={ratio}
                                                                onClick={() => setLifestyleRatio(ratio)}
                                                                className={`flex-1 text-xs font-medium py-2 rounded-lg border transition-all ${lifestyleRatio === ratio ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'}`}
                                                            >
                                                                {ratio}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Extra Context Box */}
                                                <div>
                                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                        <AlignLeft size={12} /> Specific Scene Details
                                                    </h3>
                                                    <textarea
                                                        className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none h-20 bg-white text-slate-700"
                                                        placeholder="e.g. A model walking a dog in the park..."
                                                        value={lifestyleContext}
                                                        onChange={(e) => setLifestyleContext(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )}


                                        {/* Body Type Selection for Ghost Mannequin, Angles, AND Lifestyle */}
                                        {(selectedPreset.id === PresetType.GHOST_MANNEQUIN || selectedPreset.id === PresetType.ANGLES || selectedPreset.id === PresetType.LIFESTYLE) && (
                                            <div className="mb-4">
                                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Body Type</h3>
                                                <div className="flex gap-3">
                                                    {['Men', 'Women', 'Kid'].map((type) => (
                                                        <label key={type} className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${bodyType === type ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                                                            <input
                                                                type="radio"
                                                                name="bodyType"
                                                                value={type}
                                                                checked={bodyType === type}
                                                                onChange={(e) => setBodyType(e.target.value)}
                                                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 accent-blue-600"
                                                            />
                                                            <span className="text-xs font-bold uppercase">{type}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Angle Selection Grid (Only for Angles Preset) */}
                                        {selectedPreset.id === PresetType.ANGLES && (
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Angles to Generate</h3>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {AVAILABLE_ANGLES.map((angle) => (
                                                        <label key={angle} className={`flex items-start p-2 rounded-lg border cursor-pointer transition-all ${selectedAngles.includes(angle) ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                            <input
                                                                type="checkbox"
                                                                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                                                checked={selectedAngles.includes(angle)}
                                                                onChange={() => toggleAngle(angle)}
                                                            />
                                                            <span className="ml-2 text-xs font-medium text-slate-700 leading-tight">{angle}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                                {selectedAngles.length === 0 && <p className="text-[10px] text-red-500 mt-1">Please select at least one angle.</p>}
                                            </div>
                                        )}

                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-slate-700">
                                                    Task Instructions (System Prompt)
                                                </label>
                                                {!isNamingPreset ? (
                                                    <button
                                                        onClick={initiateSave}
                                                        className={`text-xs flex items-center gap-1 font-medium transition-colors ${customPrompt.trim() || referenceImage ? 'text-blue-600 hover:text-blue-700' : 'text-slate-300 cursor-not-allowed'}`}
                                                        disabled={!customPrompt.trim() || (referenceImage && selectedPreset.id === PresetType.BG_REMOVE_REPAIR)} // Disabled if ref only & BG repair selected
                                                        title="Save current prompt & reference to library"
                                                    >
                                                        <Save size={12} /> Save Preset
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <div className="flex flex-col gap-1 items-end">
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    autoFocus
                                                                    onFocus={(e) => e.target.select()}
                                                                    type="text"
                                                                    placeholder="Preset Name"
                                                                    className="text-xs border border-blue-300 rounded px-1 py-0.5 w-24 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-900"
                                                                    value={newPresetName}
                                                                    onChange={(e) => setNewPresetName(e.target.value)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && (isPublishing ? handlePublishPrompt() : confirmSave())}
                                                                />
                                                                <button onClick={() => isPublishing ? handlePublishPrompt() : confirmSave()} className="text-green-600 hover:text-green-700 p-0.5">
                                                                    {isPublishing ? <div className="animate-spin"><Loader2 size={14} /></div> : <Check size={14} />}
                                                                </button>
                                                                <button onClick={cancelSave} className="text-red-500 hover:text-red-600 p-0.5"><X size={14} /></button>
                                                            </div>
                                                            <label className="flex items-center gap-1 cursor-pointer select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isPublishing}
                                                                    onChange={(e) => setIsPublishing(e.target.checked)}
                                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                                                                />
                                                                <span className="text-[9px] text-slate-500 font-medium">Publish</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <textarea
                                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm min-h-[140px] shadow-sm resize-y bg-white text-slate-900 select-text cursor-text font-mono"
                                                placeholder="Describe exactly what you want..."
                                                value={customPrompt}
                                                onChange={(e) => setCustomPrompt(e.target.value)}
                                                disabled={processingState.isProcessing}
                                                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                                            />
                                        </div>

                                        {(savedPrompts.length > 0 || activePromptTab === 'shared') && (
                                            <div className="mt-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Library</h4>
                                                    <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                                                        <button
                                                            onClick={() => setActivePromptTab('local')}
                                                            className={`text-[9px] font-bold px-2 py-1 rounded transition-all ${activePromptTab === 'local' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            My Prompts
                                                        </button>
                                                        <button
                                                            onClick={() => setActivePromptTab('shared')}
                                                            className={`text-[9px] font-bold px-2 py-1 rounded transition-all ${activePromptTab === 'shared' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            Shared
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto w-full">
                                                    {activePromptTab === 'local' ? (
                                                        savedPrompts.map((p, i) => (
                                                            <div key={i} className={`group flex items-center rounded-full pl-1 pr-1 py-1 transition-all max-w-full border ${promptToDelete === i ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                                                                <button
                                                                    className="flex items-center gap-2 px-2 text-left"
                                                                    onClick={() => {
                                                                        setCustomPrompt(p.text);
                                                                        if (p.referenceImage) {
                                                                            setReferenceImage(p.referenceImage);
                                                                        } else {
                                                                            setReferenceImage(null);
                                                                        }
                                                                    }}
                                                                    title={p.text}
                                                                >
                                                                    {p.referenceImage && (
                                                                        <div className="w-6 h-6 rounded overflow-hidden border border-slate-200 flex-shrink-0">
                                                                            <img src={p.referenceImage} className="w-full h-full object-cover" alt="ref" />
                                                                        </div>
                                                                    )}
                                                                    <span className="text-xs truncate max-w-[120px] font-medium text-slate-600">{p.name || "Untitled"}</span>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); deletePrompt(i); }}
                                                                    className={`p-1 rounded-full ${promptToDelete === i ? 'text-red-600 hover:bg-red-100' : 'text-slate-300 hover:text-red-500'}`}
                                                                    title={promptToDelete === i ? "Click to Confirm Delete" : "Delete"}
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        // Shared Prompts List
                                                        sharedPrompts.length === 0 ? (
                                                            <div className="w-full text-center py-2 text-[10px] text-slate-400 border border-dashed rounded-lg bg-slate-50">
                                                                No shared prompts yet. Be the first to share!
                                                            </div>
                                                        ) : (
                                                            sharedPrompts.map((p) => (
                                                                <div key={p.id} className="group flex items-center justify-between w-full bg-white border border-slate-200 rounded-lg p-2 hover:border-blue-300 transition-all cursor-pointer" onClick={() => setCustomPrompt(p.text)}>
                                                                    <div className="flex-1 min-w-0 pr-2">
                                                                        <p className="text-xs text-slate-600 line-clamp-2 leading-snug">{p.text}</p>
                                                                        <p className="text-[9px] text-slate-400 mt-0.5">{new Date(p.timestamp).toLocaleDateString()}</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => handleDeleteSharedPrompt(p.id, e)}
                                                                        className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                                                        title="Delete Shared Prompt"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>

                            <div className="p-6 border-t border-slate-200 bg-slate-50/50">
                                {processingState.isProcessing && (
                                    <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="bg-blue-100 p-1 rounded text-blue-600 mt-0.5">
                                            <Loader2 size={16} className="animate-spin" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-0.5">Processing Status</p>
                                            <p className="text-xs text-blue-600 font-medium leading-snug">
                                                {processingState.statusMessage || "Waiting for server..."}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {processingState.error && (
                                    <div className="mb-4 bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="text-red-500 mt-0.5"><AlertCircle size={18} /></div>
                                        <div>
                                            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-0.5">Error</p>
                                            <p className="text-xs text-red-600">{processingState.error}</p>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    className="w-full h-12 text-base shadow-lg shadow-blue-500/20"
                                    onClick={handleProcess}
                                    disabled={
                                        !selectedPreset ||
                                        processingState.isProcessing ||
                                        (selectedPreset.id === PresetType.ANGLES && selectedAngles.length === 0)
                                    }
                                    isLoading={processingState.isProcessing}
                                >
                                    {processingState.isProcessing ? 'Working magic...' : 'Generate Assets'}
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 bg-slate-50/50 overflow-y-auto p-8 relative">
                            <div className="max-w-5xl mx-auto h-full flex flex-col">
                                {processingState.processedImages.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                        <div className="w-24 h-24 border-4 border-dashed border-slate-200 rounded-2xl mb-6 flex items-center justify-center">
                                            <LayoutTemplate size={40} className="opacity-30" />
                                        </div>
                                        <p className="font-medium text-lg">No results yet</p>
                                        <p className="text-sm opacity-60 mt-1">Select a preset and hit Generate to see magic</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-2 auto-rows-min pb-20">
                                        {processingState.processedImages.map((img, idx) => (
                                            <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-xl transition-all duration-300 ring-0 hover:ring-1 hover:ring-slate-300 relative">
                                                {upscalingIndex?.index === idx && (
                                                    <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
                                                        <div className="animate-spin text-blue-600 mb-2">
                                                            <RotateCw size={32} />
                                                        </div>
                                                        <span className="text-sm font-medium text-blue-600">Upscaling to {upscalingIndex.resolution}...</span>
                                                    </div>
                                                )}

                                                <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-white">
                                                    <div className="flex flex-col min-w-0 mr-2">
                                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide truncate">
                                                            {getResultLabel(idx)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 truncate max-w-[150px]" title={img.filename}>
                                                            {img.filename}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-1 flex-shrink-0">
                                                        <div className="flex items-center bg-slate-100 rounded-md p-0.5 mr-1">
                                                            <button
                                                                onClick={() => handleUpscale(img, idx, '2K')}
                                                                className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 hover:bg-white rounded transition-colors"
                                                                title="Upscale to 2K"
                                                                disabled={upscalingIndex !== null}
                                                            >
                                                                2K
                                                            </button>
                                                            <div className="w-px h-3 bg-slate-300 mx-0.5"></div>
                                                            <button
                                                                onClick={() => handleUpscale(img, idx, '4K')}
                                                                className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-purple-600 hover:bg-white rounded transition-colors"
                                                                title="Upscale to 4K"
                                                                disabled={upscalingIndex !== null}
                                                            >
                                                                4K
                                                            </button>
                                                        </div>

                                                        <button
                                                            onClick={() => setImageToCrop({ type: 'result', url: img.url, index: idx })}
                                                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                                                            title="Crop & Edit"
                                                        >
                                                            <Crop size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownload(img, idx)}
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                            title={`Download as ${exportFormat.toUpperCase()}`}
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div
                                                    className="aspect-square relative bg-white pattern-checkered cursor-zoom-in overflow-hidden"
                                                    onClick={() => setLightboxIndex(idx)}
                                                    draggable={true}
                                                    onDragStart={(e) => e.dataTransfer.setData('text/plain', img.url)}
                                                    title="Drag me to Input Images to re-edit"
                                                >
                                                    <img
                                                        src={img.url}
                                                        alt={`Result ${idx}`}
                                                        className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.02]"
                                                        style={{ aspectRatio: targetAspectRatio.replace(':', '/') }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div >
    );
};

export default App;