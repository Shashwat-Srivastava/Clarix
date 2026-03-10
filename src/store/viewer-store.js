import { create } from 'zustand';

export const useViewerStore = create((set) => ({
  activeTab: 'home',
  selectedComponentId: null,
  componentFilter: '',
  componentSort: 'asc',
  wrapLines: false,
  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedComponentId: (selectedComponentId) => set({ selectedComponentId }),
  setComponentFilter: (componentFilter) => set({ componentFilter }),
  toggleComponentSort: () =>
    set((state) => ({
      componentSort: state.componentSort === 'asc' ? 'desc' : 'asc',
    })),
  toggleWrapLines: () => set((state) => ({ wrapLines: !state.wrapLines })),
  resetViewerState: () =>
    set({
      activeTab: 'home',
      selectedComponentId: null,
      componentFilter: '',
      componentSort: 'asc',
      wrapLines: false,
    }),
}));
