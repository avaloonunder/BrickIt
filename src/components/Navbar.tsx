import React from 'react';
import { Box, Upload, Play, Sparkles, Layers, FileDown } from 'lucide-react';
import { SAMPLE_MODELS, SampleModel } from '../core/sampleModels';

interface NavbarProps {
  onFileUpload: (file: File) => void;
  onSelectSample: (sample: SampleModel) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasModel: boolean;
  hasBricks: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onFileUpload,
  onSelectSample,
  activeTab,
  setActiveTab,
  hasModel,
  hasBricks,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isSampleOpen, setIsSampleOpen] = React.useState<boolean>(false);
  const sampleMenuRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sampleMenuRef.current && !sampleMenuRef.current.contains(event.target as Node)) {
        setIsSampleOpen(false);
      }
    };
    if (isSampleOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSampleOpen]);

  const handleSelectSample = (sample: SampleModel) => {
    setIsSampleOpen(false);
    onSelectSample(sample);
  };

  const navItems = [
    { id: 'voxelize', label: '1. Voxelizado', icon: Layers, enabled: true },
    { id: 'optimize', label: '2. Optimización', icon: Box, enabled: hasModel },
    { id: 'paint', label: '3. Color Studio', icon: Sparkles, enabled: hasBricks },
    { id: 'catalog', label: '4. Catálogo & BOM', icon: Box, enabled: hasBricks },
    { id: 'guide', label: '5. Guía de Montaje', icon: Play, enabled: hasBricks },
    { id: 'export', label: '6. Exportar 3MF', icon: FileDown, enabled: hasBricks },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
              <Box className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-300 bg-clip-text text-transparent">
                  BrickCraft 3D
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                  3MF & Guía PDF
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Conversor STL a Bloques Modulares Interconectables
              </p>
            </div>
          </div>

          {/* Quick Upload & Sample Picker */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Sample Selector Dropdown */}
            <div className="relative" ref={sampleMenuRef}>
              <button
                type="button"
                onClick={() => setIsSampleOpen(!isSampleOpen)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  isSampleOpen
                    ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm ring-1 ring-blue-400/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <span>Modelos de Ejemplo</span>
                <span className={`text-[10px] opacity-70 transition-transform ${isSampleOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {isSampleOpen && (
                <div className="absolute right-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                    Cargar Modelo de Prueba
                  </div>
                  <div className="max-h-72 overflow-y-auto custom-scrollbar px-1 space-y-0.5">
                    {SAMPLE_MODELS.map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => handleSelectSample(sample)}
                        className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-blue-600/30 hover:text-white rounded-lg flex items-center justify-between transition group"
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="text-base">{sample.icon}</span>
                          <div>
                            <div className="font-semibold">{sample.name}</div>
                            <div className="text-[10px] text-slate-400 group-hover:text-blue-300">
                              {sample.category}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 font-mono transition">
                          Cargar →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* STL Upload Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onFileUpload(e.target.files[0]);
                }
              }}
              accept=".stl,.obj"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition ring-1 ring-blue-400/30"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir STL</span>
            </button>

            {/* GitHub Repo */}
            <a
              href="https://github.com/Avaloonunder/BrickIt"
              target="_blank"
              rel="noreferrer"
              title="Ver en GitHub (Avaloonunder/BrickIt)"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Navigation Wizard Tabs */}
      <div className="bg-slate-900/90 border-t border-slate-800/80 px-4">
        <div className="max-w-7xl mx-auto flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-1.5 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isEnabled = item.enabled;

            return (
              <button
                key={item.id}
                onClick={() => isEnabled && setActiveTab(item.id)}
                disabled={!isEnabled}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isEnabled
                    ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    : 'text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
