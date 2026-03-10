import { create } from 'zustand';

export const useTelemetryStore = create((set) => ({
  timezone: 'UTC',
  reportFilter: '',
  reverseOrder: false,
  reportManifest: [],
  selectedReportIndex: null,
  reportCache: {},
  visibleColumns: null,
  setTimezone: (timezone) => set({ timezone }),
  setReportFilter: (reportFilter) => set({ reportFilter }),
  toggleReverseOrder: () => set((state) => ({ reverseOrder: !state.reverseOrder })),
  setReportManifest: (reportManifest) => set({ reportManifest }),
  setSelectedReportIndex: (selectedReportIndex) => set({ selectedReportIndex }),
  cacheReport: (index, report) =>
    set((state) => ({ reportCache: { ...state.reportCache, [index]: report } })),
  setVisibleColumns: (visibleColumns) => set({ visibleColumns }),
  resetTelemetry: () =>
    set({
      timezone: 'UTC',
      reportFilter: '',
      reverseOrder: false,
      reportManifest: [],
      selectedReportIndex: null,
      reportCache: {},
      visibleColumns: null,
    }),
}));
