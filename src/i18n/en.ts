/**
 * Canonical message catalogue (default language). This is the source of truth for the
 * `Messages` shape — `zh-Hant.ts` is typed against `typeof en`, so a missing, misspelt, or
 * mis-typed key in either catalogue fails `tsc`, not a blank string at runtime.
 *
 * Keys are grouped by the area of the UI (or the module) that owns them, mirroring the
 * file layout under `src/ui` / `src/core` / `src/ai` rather than being flattened —
 * that keeps a key's home obvious when you're reading the component that uses it.
 */

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
const accounts = (n: number): string => `${n.toLocaleString('en-US')} ${n === 1 ? 'account' : 'accounts'}`;

export const en = {
  common: {
    cancel: 'Cancel',
    retry: 'Retry',
    close: 'Close',
    selectAll: 'Select all',
    clear: 'Clear',
    reload: 'Reload',
    loading: 'Loading…',
    folderCount: (n: number) => plural(n, 'folder'),
    // Why an AI button is greyed out — the Organise page and the Folders page say the same thing
    fillAiEndpointFirst: 'Fill in the AI endpoint and model in Settings first.',
    fillApiKeyFirst: 'Fill in the API key in Settings first — this endpoint is not a local model, so it needs one.',
  },

  // ---- App shell (src/ui/App.tsx) ----
  app: {
    nav: { run: 'Organise', folders: 'Folders', follows: 'Follows', settings: 'Settings' },
    // 兩種長任務一次只跑一個：另一種在跑時，這一頁的主按鈕旁邊寫的原因
    busyWithFollows: 'The follow clean-up is still running — wait for it to finish, or stop it on the Follows page.',
    busyWithOrganise: 'Favourites are still being organised — wait for it to finish, or stop it on the Organise page.',
    sessionChecking: 'Checking sign-in status…',
    sessionNotSignedIn: 'Not signed in',
    sessionRecheck: 'Recheck',
    signedOutBefore: 'Not signed in to Bilibili. Sign in at',
    signedOutAfter: ', then click “Recheck” in the top-right corner.',
    loading: 'Loading…',
  },

  // ---- Organise page (src/ui/pages/RunPage.tsx and src/ui/pages/run/*) ----
  run: {
    phase: {
      fetchingList: 'Reading video list',
      fetchingDetail: 'Reading video details',
      fetchingCovers: 'Downloading covers',
      classifying: 'Classifying with AI',
      moving: 'Writing to folders',
    },
    reviewTitle: 'Review & execute',
    reviewDesc:
      'Classification is done — nothing has touched your folders yet. Writing only happens when you press the button below.',
    lowConfidenceBanner: (n: number) =>
      `${plural(n, 'video')} the model flagged as low confidence (it says it's only guessing) — not selected to move by default.`,
    showJustThese: (n: number) => `Show just these ${n}`,
    executeLabel: (move: number, copy: number): string => {
      if (copy === 0) return `Move ${plural(move, 'video')}`;
      if (move === 0) return `Copy ${plural(copy, 'video')}`;
      return `Write changes (move ${move} / copy ${copy})`;
    },
    acceptAllSuggestions: 'Accept all suggestions',
    moveNoneOf: "Don't move any",
    keepInPlaceHint:
      'A video can be in more than one folder at once: keeping it in place copies it to the target and leaves the source untouched.',
    keepAllInPlace: 'Keep all in place',
    moveAllInstead: 'Move all instead',
    confirmRemoveStale: (sourceTitle: string, n: number) =>
      `Remove ${plural(n, 'stale video')} from “${sourceTitle}”? This can't be undone.`,
    confirmRemove: 'Confirm remove',
    removeStale: (n: number) => `Remove stale videos (${n})`,
    confirmUndo: (n: number, copies: number, sourceTitle: string): string => {
      if (copies === 0)
        return `Move ${n} video${n === 1 ? '' : 's'} back to “${sourceTitle}”? Copies made to other folders will be removed too.`;
      if (copies === n)
        return `Remove the ${n} video${n === 1 ? '' : 's'} copied out this run? The original in “${sourceTitle}” is unaffected.`;
      return `Move ${n - copies} video${n - copies === 1 ? '' : 's'} back to “${sourceTitle}”, and remove the ${copies} copied out?`;
    },
    confirmUndoButton: 'Confirm undo',
    undoButtonLabel: (moved: number, copied: number, total: number): string => {
      const label = copied === 0 ? 'Undo this move' : moved === 0 ? 'Undo this copy' : 'Undo these changes';
      return `${label} (${total})`;
    },
    retryFailed: 'Retry failed',
    changeSettingsRerun: 'Change settings & rerun',
    clearResults: 'Clear results',
    targetFoldersTitle: 'Target folders',
    targetFoldersDesc:
      "Tick the folders the AI is allowed to move videos into. It classifies using each folder's description — write those on the Folders page.",
    filterTargetsPlaceholder: 'Filter targets…',
    filterTargetFolders: 'Filter target folders',
    selectedCount: (n: number, total: number) => `${n} / ${total} selected`,
    editDescriptionsOnFoldersPage: 'Edit descriptions on the Folders page',
    previousResultBanner: (n: number) =>
      `Your last classification result (${n} videos) is still here — starting again after changing settings will overwrite it.`,
    backToReview: 'Back to review',
    whatThisFolderCollects: 'What this folder collects',
    noDescriptionAiOnlyName: '(Not filled in — the AI can only see the folder name)',
    fromBilibiliDescription: 'From Bilibili description',
    sourceKnownHint:
      'The AI knows the video is already here: if it fits this description and no target folder is a clearly better match, it stays.',
    editDescription: 'Edit description',
    startClassification: 'Start classification',
    targetCount: (n: number) => plural(n, 'target'),
    scopeAll: 'All',
    scopeLatest: 'Latest',
    videosUnit: (n: number) => plural(n, 'video'),
    pickSourceFirst: 'Pick a source folder on the left first.',
    noTargetsSelected: "No target folders selected yet — the AI only moves videos into folders you've ticked.",
    selectAllCount: (n: number) => `Select all ${n}`,
    footerBili: (n: number) => `Bilibili ${n}`,
    footerAi: (n: number) => `AI ${n}`,
    footerMinutes: (n: number) => `≈${n} min`,
    nowOrganising: 'Now organising',
    whyNothingToWrite: 'No row is set to move or copy — pick a target on a row, or accept the suggestions.',
    wroteBanner: (n: number) => `Done — ${n.toLocaleString('en-US')} videos written to the folders you picked.`,
    whyRunFinished: 'This run has been written. Undo it here, or clear the results to start again.',
    whyRunStopped: 'This run stopped with an error — the message is above the table.',
    // Shown on the prepare screen — usually because the run failed before it produced a single review row
    runFailedBanner: (message: string) => `This run stopped: ${message}`,
    openSettings: 'Open Settings',
    allVideos: 'All videos',
    latestSaved: (n: number) => `Latest ${n} saved`,
    progress: 'Progress',
  },

  // ---- src/ui/pages/run/BatchPanel.tsx ----
  batchPanel: {
    thisRun: 'This run',
    pickSourceFirst: 'Pick a source folder on the left first.',
    scope: 'Scope',
    scopeAllOption: (n: number) => `All (${n.toLocaleString('en-US')} videos)`,
    scopeLatestOption: 'Latest saved',
    scopeLatestCountLabel: 'Number of latest saved videos',
    scopeLatestUnit: 'videos',
    scopeHint: 'Newest first, by save time — good for organising a big folder in batches.',
    thisWillCost: 'This run will cost',
    videosToProcess: 'Videos to process',
    bilibiliReads: 'Bilibili reads',
    coverDownloads: 'Cover downloads',
    aiCalls: 'AI calls',
    estimatedTime: 'Estimated time',
    costHint: (readRps: number) => `Estimated at ${readRps} req/s; cached details aren't refetched, and moves aren't counted.`,
    requestDetailsAndPrompt: 'Request details & prompt',
    stepsThisRunTakes: 'Steps this run takes',
  },

  // ---- src/ui/pages/run/ProgressPanel.tsx ----
  progressPanel: {
    used: 'Elapsed',
    estRemaining: 'Est. remaining',
    actualRate: 'Actual rate',
    cacheHits: 'Cache hits',
    couldNotFetch: "Couldn't fetch",
    cancel: 'Cancel',
    backgroundTabWarning:
      "This run holds a Web Lock, so switching tabs won't freeze it — but Chrome still throttles background timers, which roughly halves the read rate. Staying in the foreground is faster.",
    recentRequests: 'Recent requests',
    noRequestsYet: 'No requests sent yet.',
    reviewTable: 'Review table',
    reviewTableAppearsHere: 'Appears here when this run is done',
    estRemainingShort: (clock: string) => `Est. ${clock} left`,
    cancelThisRun: 'Cancel this run',
    legendFetched: 'fetched now',
    legendCached: 'from cache',
  },

  // ---- src/ui/pages/run/ReviewRail.tsx ----
  reviewRail: {
    thisRun: 'This run',
    detailsFetched: 'Details fetched',
    cacheHits: 'Cache hits',
    aiCalls: 'AI calls',
    moved: 'Moved',
    copied: 'Copied',
    staleRemoved: 'Stale removed',
    detailsUnavailable: 'Details unavailable',
    savedAt: (time: string) => `Saved ${time}`,
    filter: 'Filter',
    onlyShowMovingInto: 'Only show moving into',
    allTargets: 'All targets',
    facets: {
      all: 'All',
      move: 'Moving',
      copy: 'Copying',
      stay: 'Not moving',
      lowConfidence: 'Low confidence',
      invalid: 'Stale',
      done: 'Done',
      failed: 'Failed',
    },
  },

  // ---- src/ui/pages/run/RunDetailsDialog.tsx ----
  runDetailsDialog: {
    ariaLabel: 'What this run will do',
    title: 'What this run will do',
    desc: (n: number) =>
      `Estimated for the ${n.toLocaleString('en-US')} videos this run will process; changes to settings update this automatically.`,
    tabs: { flow: 'Steps', requests: 'Requests', prompt: 'Prompt' },
  },

  // ---- src/ui/pages/run/SourceRail.tsx ----
  sourceRail: {
    sourceFolder: 'Source folder',
    searchFolders: 'Search folders…',
    searchNFolders: (n: number) => `Search ${n} folders…`,
    retry: 'Retry',
    source: 'Source',
    noMatchingFolders: 'No matching folders.',
    folderCount: (n: number, total: number) => `${n} folder${n === 1 ? '' : 's'} · ${total.toLocaleString('en-US')} videos`,
    reload: 'Reload',
  },

  // ---- src/ui/components/ReviewTable.tsx ----
  reviewTable: {
    emptyFiltered: (total: number) => `No videos match this filter (${total} classified this run).`,
    shown: (n: number, total: number) => `${n} / ${total} shown`,
    prevPage: 'Previous page',
    nextPage: 'Next page',
    cover: 'Cover',
    video: 'Video',
    aiSuggestion: "AI's suggestion & reason",
    targetFolders: 'Target folders (pick any)',
    status: 'Status',
    collection: (title: string) => `Collection: ${title}`,
    staysInPlace: 'Stays in place',
    lowConfidenceHint: 'Low confidence, not moved by default',
    fieldsUsed: 'Fields used: ',
    dontMove: "Don't move",
    changeTo: 'Change to…',
    collapse: 'Collapse',
    alsoKeepInPlace: 'Also keep in place',
    alsoKeepInPlaceTitle: "Don't move out of the source folder — copy instead",
    searchFolders: 'Search folders',
    searchFoldersPlaceholder: 'Search folders…',
    noMatchingFolders: 'No matching folders.',
    keptCopiedOut: (n: number) =>
      n > 1 ? `Stays in source, ${n} copies made elsewhere` : 'Stays in source, one copy made elsewhere',
    movedOut: (n: number) => (n > 1 ? `Moves out of source, into ${n} folders` : 'Moves out of source'),
    whatWasSent: 'What was sent',
    statusMovedFailed: (copying: boolean) => `${copying ? 'Copied' : 'Moved'} (undo failed)`,
    statusMoved: 'Moved',
    statusCopied: 'Copied',
    statusRemoved: 'Removed',
    statusFailed: 'Failed',
    statusMoving: 'Moving…',
    statusCopying: 'Copying…',
    statusStale: 'Stale',
    staleTitle:
      'This video is no longer available — it is never classified or moved. Remove it with the button in the bar below.',
    statusToCopy: 'To copy',
    statusToMove: 'To move',
    statusNotMoving: 'Not moving',
  },

  // ---- src/ui/components/TargetFolderTable.tsx ----
  targetFolderTable: {
    noTargetCandidates: 'No folders available as a target.',
    missingDescriptionsBanner: (n: number) =>
      `${plural(n, 'selected folder')} ${n === 1 ? 'has' : 'have'} no description and no Bilibili intro, so the AI can only go by the folder name.`,
    fillThemIn: 'Fill them in',
    folder: 'Folder',
    descriptionHeader: 'Description (what the AI uses)',
    selectAsTarget: (title: string) => `Add as target: ${title}`,
    private: 'Private',
    default: 'Default',
    noDescriptionAiOnlyName: '(Not filled in — the AI can only see the name)',
    fromBilibiliDescription: 'From Bilibili description',
    noMatchingFolders: 'No matching folders.',
  },

  // ---- src/ui/components/PromptDialog.tsx ----
  promptDialog: {
    ariaLabel: 'What was sent to the AI',
    copy: 'Copy',
    copied: 'Copied',
    charCount: (n: number) => `${n} chars`,
    close: 'Close',
    videoCount: (n: number) => ` · ${plural(n, 'video')}`,
    coversAttached: (n: number) => `, ${plural(n, 'cover')} attached`,
    tokensSent: (sent: string, received: string) => ` · tokens sent ${sent} / received ${received}`,
    system: 'System prompt (system)',
    user: 'What was sent (user)',
    reasoning: "Model's reasoning (reasoning)",
    reply: "Model's reply (raw text)",
  },

  // ---- src/ui/components/PromptPreview.tsx ----
  promptPreview: {
    intro:
      'Built from two sample videos (one with full details, one with just a title) — this is the actual content that would be sent.',
    system: 'System prompt (system)',
    user: 'What was sent (user)',
  },

  // ---- core/promptPreview.ts notes ----
  promptPreviewNotes: {
    noDetail: 'No details fetched — the only clues available are the title, intro, duration and uploader',
    visionUnverified: "Vision mode hasn't been verified yet, so attaching covers doesn't take effect for now",
    coverPlaceholder: 'Images are sent inline as base64 — a placeholder is used here instead',
    subtitleNeedsDetail: "Subtitles are fetched together with details, so they won't appear with the current detail setting",
    join: (notes: string[]) => (notes.length > 0 ? `${notes.join('; ')}.` : ''),
  },

  // ---- core/flow.ts (rendered by FlowSteps.tsx, RunPage's running rail, BatchPanel) ----
  flow: {
    skip: 'Skip',
    steps: {
      list: {
        title: 'Read the video list',
        detail: (pageSize: number) =>
          `Up to ${pageSize} videos per page (Bilibili sometimes returns only 25, so it may take a few extra pages), newest saved first; "latest N saved" stops once it has enough. Stale videos are pulled out and not sent for classification.`,
      },
      invalid: {
        title: 'Remove stale videos',
        detail:
          'Stale videos are never classified; clear them from the review table with "Remove stale videos" — one request per batch, and it can\'t be undone.',
      },
      detail: {
        title: 'Read video details (tags, collection, category)',
        detailOn: (ttlDays: number) => `One request per video, cached for ${ttlDays} days; cache hits aren't refetched.`,
        detailOff: 'Not fetched — classification uses only the title, intro, duration and uploader from the list.',
      },
      subtitle: {
        title: 'Fetch subtitles',
        off: 'Not fetched.',
        needsDetail:
          'Subtitles are fetched together with video detail; they won\'t be fetched while detail is set to "Don\'t fetch".',
        on: 'Tried for every video: human subtitles first, then AI subtitles, skipped if neither exists (up to 2 requests per video).',
      },
      cover: {
        title: 'Download cover thumbnails',
        visionInactive: 'Vision mode isn\'t enabled (tick "model supports vision" and pass "Test vision" first).',
        on: "A 320×200 thumbnail is fetched for every video and cached for 7 days; videos it can't fetch for fall back to text only.",
        off: 'Currently set to "no images".',
      },
      classify: {
        title: 'AI classification',
        withCover: (batchSize: number) =>
          `Every video includes its cover, ${batchSize} per batch (smaller batches when images are attached — more images makes mix-ups more likely).`,
        textOnly: (batchSize: number) => `Plain text, ${batchSize} per batch.`,
      },
      review: {
        title: 'Review',
        detail:
          "Results land in the review table first, where you can change targets, deselect, or filter. This step doesn't touch your folders.",
      },
      move: {
        title: 'Execute the move',
        detail: (moveBatchSize: number) =>
          `Only happens once you press the button: same-target videos are grouped into batches of up to ${moveBatchSize}; for multi-target videos, all but the last target use copy and the last uses move. Rows with "also keep in place" ticked use copy for every target, so the source is left untouched.`,
      },
    },
  },

  // ---- core/estimate.ts (rendered by RequestTable.tsx / BatchPanel / DataSourcesSection) ----
  estimate: {
    kindLabel: { bili: 'Bilibili API', cdn: 'Image CDN', ai: 'AI endpoint' },
    rows: {
      nav: {
        purpose: 'Confirm sign-in status and WBI signing key',
        note: 'Cached once a day, on page open',
      },
      folders: {
        purpose: 'Folder list, thumbnails, Bilibili descriptions (used by "import from Bilibili")',
        note: 'On page open, or when you reload',
      },
      list: {
        purpose: 'Video title, intro, cover URL, duration, parts, uploader, save time',
        note: (pageSize: number, pageYield: number) =>
          `Up to ${pageSize} per page — Bilibili sometimes returns only 25, so this is estimated at ${pageYield} per page`,
      },
      detail: {
        purpose: 'Tags, collection name and sibling titles, category, activity post, part titles, collaborators',
        noteOn: "Once per video; cache hits aren't refetched",
        noteOff: 'Not fetched — uses only the fields already in the list',
      },
      subtitle: {
        endpointSuffix: ' + subtitle JSON',
        purpose: 'Full subtitle text (human subtitles preferred, AI subtitles as fallback)',
        noteOff: 'Not fetched',
        noteNeedsDetail:
          'Subtitles won\'t be fetched either, because video detail is set to "don\'t fetch" (subtitles are fetched together with detail)',
        noteOn: 'Up to 2 per video; videos with no subtitles at all only cost 1',
      },
      cover: {
        endpointSuffix: ' (image CDN)',
        purpose: 'A 320×200 cover thumbnail, attached so the vision model can judge the content',
        noteOn: "Attached for every video; cache hits aren't refetched",
        noteVisionInactive: "Vision mode isn't enabled",
        noteTextOnly: 'Currently set to text only',
      },
      ai: {
        endpointSuffix: ' (your AI endpoint)',
        purpose: 'Classify: send one batch of videos, get back which folders each should go into',
        note: (batchSize: number, withCover: boolean) => `${batchSize} per batch${withCover ? ' (with images)' : ''}`,
      },
      move: {
        purpose: 'Move videos (multi-target videos use copy for all but the last)',
        note: (moveBatchSize: number) =>
          `Only happens once you press "Execute move", up to ${moveBatchSize} per batch — this is the upper bound if everything moves`,
      },
    },
  },

  // ---- src/ui/components/RequestTable.tsx ----
  requestTable: {
    request: 'Request',
    whatItGets: 'What it gets',
    count: 'Count',
    against: 'Target',
  },

  // ---- src/ui/pages/FoldersPage.tsx ----
  folders: {
    title: 'Folders & descriptions',
    desc: "The description is the AI's most important input. The Organise page only picks source and targets — descriptions are always edited here.",
    descriptionCoverage: 'Description coverage',
    haveUsableDescription: 'Have a description',
    coverageHint:
      'Folders with no description leave the AI only the folder name to go on — the measured accuracy gap is 94% → 100%.',
    filter: 'Filter',
    facets: {
      all: 'All',
      missing: 'No description',
      fromBili: 'Uses Bilibili intro',
      draft: 'Has a draft',
      private: 'Private',
    },
    howToWrite: 'How to write one',
    howToWriteP1:
      'One sentence for what the folder collects, in 20 characters or fewer. Write it too narrowly and the next run will only move videos into that narrow range.',
    howToWriteP2:
      '"Generate with AI" samples the whole folder evenly (up to 6 pages, 80 videos), not just the newest page; ticking "use current description" keeps your existing scope instead of narrowing it.',
    howToWriteP3:
      'Left blank, the run automatically falls back to the Bilibili description; if both are empty, the AI only has the folder name to go on.',
    searchFolders: 'Search folders',
    searchFoldersPlaceholder: 'Search folders…',
    selectedPrefix: '',
    selectedSuffix: ' selected',
    selectAll: 'Select all',
    clear: 'Clear',
    reloading: 'Reloading…',
    reload: 'Reload',
    draftsPending: (n: number) => `${plural(n, 'draft')} not accepted yet — click "Accept all" to save them.`,
    acceptAll: 'Accept all',
    discardAll: 'Discard all',
    folder: 'Folder',
    descriptionHeader: 'Description (tell the AI what this folder collects)',
    bilibiliIntro: 'Bilibili description',
    private: 'Private',
    default: 'Default',
    descPlaceholder: 'One sentence, e.g. "Illustrations and artist work"',
    charCount: (n: number) => `${n} chars`,
    generating: 'Generating…',
    generateWithAi: 'Generate with AI',
    usesBiliIntroTag: 'Uses the description on the right when organising',
    noDescriptionOriginally: '(No description originally)',
    aiDraftTag: 'AI draft',
    accept: 'Accept',
    regenerate: 'Regenerate',
    discard: 'Discard',
    emptyBilibiliIntro: '(Empty)',
    newFolderNamePlaceholder: 'New folder name',
    newFolderIntroPlaceholder: 'Description (optional, also used by the AI)',
    private2: 'Private',
    create: 'Create',
    selectCheckbox: (title: string) => `Select: ${title}`,
    checkCheckbox: (title: string) => `Tick: ${title}`,
    descriptionAriaLabel: (title: string) => `Description: ${title}`,
    descriptionDraftAriaLabel: (title: string) => `Description draft: ${title}`,
    // batch-run footer
    selectedFoldersSuffix: (n: number) => ` ${n === 1 ? 'folder' : 'folders'} selected`,
    generateDescriptions: 'Generate with AI',
    useCurrentDescription: 'Use current description',
    importFromBili: 'Import from Bilibili description',
    syncToBili: 'Sync descriptions to Bilibili',
    footerWhy:
      "Batches always run one at a time and can be cancelled mid-way; folders with no description are skipped when syncing, so their Bilibili description isn't cleared.",
    footerEmpty: 'Tick folders first — then you can generate, import or sync their descriptions.',
    cancel: 'Cancel',
    // notes
    cancelledNote: (label: string) => `${label} was cancelled.`,
    someFailedNote: (label: string, failures: string[]) =>
      `${label}: ${plural(failures.length, 'failure')}. ${failures.join('; ')}`,
    doneNoteMulti: (label: string, n: number) => `${label} done (${n} folders).`,
    doneNote: (label: string) => `${label} done.`,
    generateInto: (title: string) => `Generate a description for “${title}”`,
    generateChosen: 'Generate descriptions with AI',
    noUsableVideosError: (scanned: number) => `No usable videos in this folder (read ${scanned}).`,
    itemFailed: (title: string, message: string) => `${title}: ${message}`,
    importSummary: (n: number, same: number, empty: number): string => {
      const parts = [`Imported ${plural(n, 'draft')} from Bilibili descriptions`];
      if (same > 0) parts.push(`${same} already match${same === 1 ? 'es' : ''} the current description`);
      if (empty > 0) parts.push(`${empty} ${empty === 1 ? 'has' : 'have'} no Bilibili description`);
      return `${parts.join(', ')}.${n > 0 ? ' Click "Accept all" to save them.' : ''}`;
    },
    adoptedDrafts: (n: number) => `Accepted ${plural(n, 'draft')}.`,
    noWritableDescriptions: (n: number) =>
      `None of the ${n} selected folders have a description, so there's nothing to sync (sending an empty description would clear the Bilibili one, so it's skipped).`,
    syncDescriptions: 'Sync descriptions to Bilibili',
    skippedSync: (n: number) =>
      ` (skipped ${n} folder${n === 1 ? '' : 's'} with no description, to avoid clearing the Bilibili one)`,
    createDone: 'Folder created.',
    createFailed: (message: string) => `Couldn't create folder: ${message}`,
  },

  // ---- Settings page (src/ui/pages/settings/*) ----
  settings: {
    groups: {
      organise: 'Organise favourites · needs AI',
      shared: 'Shared by both tools',
      follows: 'Follow clean-up · no AI',
    },
    sections: {
      endpoint: {
        title: 'AI endpoint',
        desc: 'Any OpenAI-compatible endpoint works. Left empty, the Organise page’s "Start classification" greys out and says why; the follow clean-up never reads this chapter.',
      },
      sources: {
        title: 'What the AI sees',
        desc: 'Three data sources — the more you enable, the more accurate the classification and the more requests it takes. The cost on the right is for 100 videos with no cache and updates as you change things.',
      },
      instructions: {
        title: 'Classification instructions',
        desc: 'The classification rules are built in — this is only for habits only you know about. To change what one folder collects, edit its description on the Folders page instead.',
      },
      speed: {
        title: 'Read & write speed',
        desc: 'How fast requests go out to Bilibili. Shared by both tools (they never run at the same time). Rate limiting triggers an automatic back-off; if it still fails, the run stops and keeps its progress.',
      },
      data: {
        title: 'Cache & backup',
        desc: 'What this extension remembers between runs, and how to take it with you. Clearing a cache only means the next run fetches again; your folders and follows are untouched.',
      },
      language: {
        title: 'Language',
        desc: 'The language of this interface, the video-page button and progress messages. Applies at once. What gets sent to the AI stays in Chinese either way — that is a functional input, not UI.',
      },
    },
    scope: {
      usedBy: 'Used by',
      notUsedBy: 'not used by',
      organise: 'Organise',
      descriptions: 'Folder descriptions',
      quickFav: 'Smart favourite (video page)',
      follows: 'Follow clean-up',
    },
    followsPointer: {
      title: (days: number) => `Threshold ${days} days · quiet follows`,
      desc: 'Both live on the Follows page — changing them there is changing the setting.',
    },
    required: 'required',
    defaultLabel: 'Default',
    languageLabel: 'Interface language',
    nav: {
      // "Connected" is only true after Test connection passed; before that the fields are merely filled in
      connected: 'Connected',
      endpointSet: 'Endpoint set · not tested',
      noApiKey: 'No API key',
      visionVerified: 'Vision verified',
      noEndpointOrModel: 'No endpoint or model set',
      tags: { detail: 'Detail', subtitle: 'Subtitle', cover: 'Cover' },
      perBatch: (n: number) => `${n}/batch`,
      customInstructions: (n: number) => `${n}-character custom instructions`,
      noCustomInstructions: 'No custom instructions',
      speed: (preset: string, rps: number, ms: number) => `${preset} · ${rps} req/s · ${ms} ms`,
      cache: (n: number) => `${n} ${n === 1 ? 'detail' : 'details'}`,
      activityCache: (n: number) => `${n} ${n === 1 ? 'account' : 'accounts'}`,
    },
    keyStoredLocally: 'The key is only stored on this computer, in',
    keyStoredLocallyAfter: ', and only ever sent to the endpoint you enter.',
    save: 'Save settings',
    saveN: (n: number) => `Save ${n} change${n === 1 ? '' : 's'}`,
    unsavedIn: (sections: string) => `Changed and not saved yet: ${sections}.`,
    nothingToSave: 'No unsaved changes — edit a field and the button lights up.',
    saved: 'Saved.',
    unauthorizedEndpoint:
      "Not authorised to access this endpoint — AI features won't work. Please save again and allow the permission.",
    visionSavedNote: "Vision setting saved along with the rest of this page's settings.",
    exportedNote: (n: number) =>
      `Exported ${n} description${n === 1 ? '' : 's'} and the current settings (excluding the API key).`,
    importedNote: (n: number, withSettings: boolean) =>
      `Imported ${n} description${n === 1 ? '' : 's'}${withSettings ? ' and settings' : ''}.`,
    importFailedNote: (message: string) => `Import failed: ${message}`,
    promptDialogAriaLabel: 'What gets sent to the AI',
    whatGetsSentToAi: 'What gets sent to the AI',
    close: 'Close',
    chapterReadout: (i: number, total: number, changed: number) =>
      `${String(i).padStart(2, '0')} / ${String(total).padStart(2, '0')} · ${changed} changed`,
    chapterAria: (no: string, title: string) => `Go to ${no} ${title}`,
  },

  // ---- ConnectionSection.tsx (01 AI endpoint) ----
  connection: {
    baseUrl: {
      label: 'Base URL',
      desc: "The endpoint's root address. Calls {Base URL}/chat/completions — most services need it to end in /v1; a local model can be http://localhost.",
      default: 'https://api.openai.com/v1',
      invalid:
        'Only https:// addresses, or http://localhost and http://127.0.0.1 for a local model. Nothing is saved until this is fixed — the address you typed is never swapped for a different service.',
    },
    apiKey: {
      label: 'API Key',
      desc: 'The key the endpoint gave you. Stored only on this computer; never written into a backup, never sent to Bilibili. A local model on localhost usually needs no key.',
    },
    model: {
      label: 'Model',
      desc: "The model name as the endpoint's documentation spells it. Classifying videos and generating folder descriptions use the same one.",
      default: 'gpt-4o-mini',
    },
    test: {
      label: 'Test connection',
      desc: 'Sends one short prompt and shows the reply. The first time, Chrome asks for permission — only for the origin you entered.',
    },
    vision: {
      label: 'This model understands images',
      desc: 'When on, press "Test vision": one picture is sent and you confirm the description matches. Only then does "Attach covers" in 02 take effect. Re-test after changing the model or URL.',
      default: 'off',
      stateOff: 'Off · text-only classification',
      stateOn: 'On',
    },
    compat: {
      label: 'Endpoint compatibility',
      desc: 'Temperature and extra request parameters (JSON). Most people never change these; DeepSeek needs one line here to switch thinking mode off.',
    },
    apiKeyHide: 'Hide',
    apiKeyShow: 'Show',
    testing: 'Testing…',
    testConnection: 'Test connection',
    unauthorized: 'Not authorised to access this endpoint',
    reply: (text: string) => `Reply: ${text}`,
    replyReasoningOnly: (text: string) => `Reply (reasoning only): ${text}`,
    modelReply: (text: string) => `Model reply: ${text}`,
    modelReplyReasoningOnly: (text: string) => `Model reply (reasoning only): ${text}`,
    noReplyContent: 'The model returned no reply content',
    verified: 'Verified',
    testingVision: 'Testing…',
    testVision: 'Test vision',
    doesItMatchQuestion:
      'The image is a dark rounded square with a white tick mark and a pink progress bar with a round knob — does the description match it?',
    matchesEnable: 'It matches, enable',
    visionEnabled: 'Vision mode enabled.',
    doesntMatch: "Doesn't match",
    visionDisabled: "Doesn't match — vision mode stays off.",
    temperature: 'Temperature',
    temperatureNotSent: 'Not sent',
    temperatureHint:
      "Leave blank to omit this parameter (most reasoning models only accept the default). Setting it to 0 doesn't guarantee stable output either — about 20% of reruns on the same prompt still differ.",
    extraBodyLabel: 'Extra request parameters (JSON)',
    extraBodyHintBefore:
      'Merged as-is into the request body (model and messages are ignored). For example, DeepSeek v4 enables thinking mode by default — fill in',
    extraBodyHintAfter: 'to turn it off, which classifies faster and uses fewer tokens.',
    extraBodyInvalid: 'Not a valid JSON object — this field is ignored.',
    invalidBaseUrl: (message: string) => `Invalid base URL: ${message}`,
  },

  // ---- DataSourcesSection.tsx (02 What the AI sees) ----
  dataSources: {
    sources: {
      detail: {
        name: 'Fetch video details',
        badge: 'Recommended',
        desc: (ttlDays: number) =>
          `Tags, collection name and sibling titles, category, activity post, part titles, collaborators. Tags are the single biggest driver of accuracy — without them, the AI can only guess from the title. Results are cached for ${ttlDays} days.`,
        default: 'on',
        unit: 'requests',
      },
      subtitle: {
        name: 'Fetch subtitles',
        descOn:
          'Human subtitles preferred, AI subtitles as fallback; two extra requests and 1–2 extra seconds per video. Only worth it for folders where titles and tags are both vague.',
        descOff: "Subtitles are fetched together with video detail; they won't be fetched while detail is off.",
        default: 'off',
        unit: 'requests',
      },
      cover: {
        name: 'Attach covers for the model to see',
        badgeNeedsTest: 'Needs "Test vision" in 01 first',
        desc: 'Downloads one extra 320×200 thumbnail per video and switches to the vision batch (far fewer videos per call, so more AI calls overall). No measurable accuracy gain in testing — writing good folder descriptions matters far more.',
        default: 'on, once the vision test has passed',
        unit: 'thumbnails',
      },
    },
    perBatch: 'Videos per batch',
    perBatchHintCover: 'Smaller batches when images are attached — more images makes mix-ups more likely; 8–12 is a good range.',
    perBatchHintText:
      'Plain text can send more per batch at once — 20–40 is a good range; switching to images automatically switches to the vision batch size.',
    perBatchDefault: 'text 30 · with covers 10',
    whatGetsSent: 'What this setting sends',
    userMessageStart: 'The start of the user message.',
    expandFull: 'Expand full text',
    thisSettingCosts: 'Cost of this setting',
    noCache: (n: number) => `${n} videos · no cache`,
    bilibiliReads: 'Bilibili reads',
    coverImages: 'Cover images',
    aiCalls: 'AI calls',
    minutes: 'Minutes',
    fadedRowsNote: (minutes: number) =>
      `The faded rows are data sources that are turned off. Moving isn't counted in the "≈${minutes} minutes" above — that only happens once you press the button on the review table.`,
  },

  // ---- InstructionsSection.tsx (03 Classification instructions) ----
  instructions: {
    label: 'Custom classification instructions (optional)',
    example: 'MMD and 3D dance videos always go into "Art / Illustrations"; skip a tutorial video rather than guess its topic.',
    hint: (used: number, max: number) =>
      `Appended after the system prompt, taking priority over the built-in rules (except for output format). Used by both the Organise run and the video page's "Smart favourite".${used > 0 ? ` ${used}/${max} characters used.` : ''}`,
  },

  // ---- SpeedSection.tsx (04) + DataSection.tsx (05) ----
  speedData: {
    preset: { label: 'Speed', default: '2 req/s · 800 ms (the "Default" preset)' },
    ratePresets: {
      safe: {
        label: 'Conservative',
        note: 'Use this if you were rate-limited before, or the folder is very large; takes roughly twice as long',
      },
      normal: { label: 'Default', note: "A speed that's held up well in testing — use this unless you have a reason not to" },
      fast: {
        label: 'Fast',
        note: 'Noticeably more likely to get rate-limited (-412 / -799) — only for small numbers of videos',
      },
    },
    custom: 'Custom',
    customNote: "Current values don't match any preset — set them manually below",
    rateHint:
      'On -412 / -799 / HTTP 412 the run pauses and retries after 60→120→240 s; if it still fails, it stops and keeps its progress. Checking follows is one request per account — with thousands of follows, Conservative is the safer choice.',
    manual: {
      label: 'Set values manually',
      desc: 'The three numbers behind the presets. Change one and the preset above reads "Custom".',
    },
    readRate: 'Read rate (req/s)',
    readRateHint: 'The actual interval also has ±30% jitter.',
    writeInterval: 'Write interval (ms)',
    writeIntervalHint: 'Minimum interval between two writes — folder moves, unfollows and follow-agains alike.',
    perMoveBatch: 'Videos per move',
    perMoveBatchHint: 'On -632 (limit exceeded), it automatically splits the batch in half.',
    videoCache: {
      label: 'Video cache',
      desc: (detailTtlDays: number) =>
        `Video details are kept for ${detailTtlDays} days, cover thumbnails for 7. Organise reuses them so a rerun on the same folder is mostly free.`,
    },
    activityCache: {
      label: 'Account activity cache',
      desc: (activityTtlDays: number) =>
        `Each account's latest upload is kept for ${activityTtlDays} days; accounts that could not be checked are always looked up again. The follow clean-up only asks Bilibili about accounts missing here.`,
    },
    calculating: 'Calculating…',
    cacheSummary: (details: number, covers: number) => `${details} video details, ${covers} covers`,
    activityCacheSummary: (n: number, oldest: string) =>
      `${n} checked ${n === 1 ? 'account' : 'accounts'}, oldest result from ${oldest}`,
    activityCacheEmpty: 'No checked accounts yet',
    clear: 'Clear',
    backup: {
      label: 'Backup',
      desc: "Folder descriptions are the hardest thing to rebuild here — each one takes a write or an AI generation. The export doesn't include the API key; it does include the follow threshold and “include quiet follows”.",
    },
    exportDescriptionsAndSettings: 'Export descriptions & settings',
    import: 'Import',
  },

  // ---- Content script quick favourite (src/entrypoints/quickFav.content.ts) + core/quickFav.ts ----
  quickFav: {
    buttonTitle: 'Use AI to decide which folder this belongs in',
    buttonLabel: 'Smart favourite',
    analysing: 'Smart favourite',
    analysingSub: 'Analysing…',
    close: 'Close',
    retry: 'Retry',
    failedTitle: 'Smart favourite failed',
    savedTo: (title: string) => `Saved to “${title}”`,
    undoSave: 'Undo save',
    changeSelection: 'Change selection',
    saveFailedTitle: 'Save failed',
    removedFrom: (title: string) => `Removed from “${title}”`,
    removeFailedTitle: 'Undo failed',
    searchFoldersPlaceholder: 'Search folders…',
    noObviousMatch: "The AI couldn't find an obviously suitable folder",
    lowConfidenceReason: (reason: string) => `The AI isn't sure: ${reason}`,
    apply: 'Apply',
    writeFailedTitle: 'Write failed',
    folderNameList: (titles: string[]) => titles.map((title) => `“${title}”`).join(', '),
    removedMultiple: (titles: string) => `Removed from ${titles}`,
    basisSuffix: (basis: string[]) => ` · Fields used: ${basis.join(' → ')}`,
    connectionFailed: (message: string) => `Couldn't connect to the extension: ${message}`,
    // core/quickFav.ts (bubble up as errors in the toast)
    noAiEndpoint: "No AI endpoint set — open biliTidy's settings first",
    noFolders: 'This account has no folders',
  },

  // ---- Shared error translations (src/bilibili/*, src/ai/client.ts, src/ai/parser.ts, src/core/*, src/net/*, src/shared/*, background.ts) ----
  errors: {
    bilibili: {
      notSignedIn: 'Not signed in to Bilibili — please sign in at bilibili.com first',
      banned: 'This account has been suspended',
      csrfFailed: 'CSRF check failed (the cookie may have changed)',
      riskControl: (code: number, message: string) => `Likely flagged for rate limiting (${code}): ${message}`,
      forbidden: (message: string) => `Access denied: ${message}`,
      notFound: (message: string) => `Not found: ${message}`,
      followLimit: 'Follow limit reached — Bilibili refused the follow',
      limitExceeded: 'Too many items for a single request',
      apiError: (code: number, message: string) => `Bilibili API error ${code}: ${message}`,
      http412: 'HTTP 412: this IP has been flagged for rate limiting by Bilibili, please try again later',
      notJson: 'The response was not valid JSON',
      wbiOrRiskCheckFailed: 'WBI signature or rate-limit check failed (v_voucher)',
      navMissingWbi: 'The nav response is missing wbi_img',
      archiveListEmpty: "Bilibili reported uploads for this account but returned none — can't tell when the latest one was",
      noBiliJctCookie: "Couldn't find the bili_jct cookie — please sign in to Bilibili first",
    },
    network: {
      generic: (message: string) => `Network error: ${message}`,
      cancelled: 'Cancelled',
    },
    ai: {
      noEndpointOrModel: 'No AI endpoint or model set',
      notAuthorized: 'Not authorised to access the AI endpoint — save the base URL in Settings and allow the permission',
      timeout: (seconds: number) => `The AI endpoint took more than ${seconds}s to respond`,
      invalidEndpointUrl: '(invalid endpoint URL)',
      withEndpointSuffix: (message: string, endpoint: string) => `${message} (${endpoint})`,
      httpError: (endpoint: string, status: number, text: string, hint: string) =>
        `${endpoint} responded ${status}: ${text}${hint}`,
      hint404: '; the endpoint path may be wrong (most services need the base URL to end in /v1)',
      hint401: '; the API key may be invalid',
      notJson: "The AI's reply wasn't valid JSON",
      noChoices: (message: string | undefined) => `The AI's reply had no choices${message ? `: ${message}` : ''}`,
      noReplyContent: (facts: string[], truncated: boolean) => {
        const detail = facts.length ? ` (${facts.join(', ')})` : '';
        const cut = truncated ? '; output was cut off by max_tokens' : '';
        return `The model returned no reply content${detail}${cut}`;
      },
      onlyReasoningNoReply:
        "The model only returned its reasoning, with no actual reply — the classification can't be parsed. Try a different model, or turn off reasoning mode.",
      couldNotParseReply: "Couldn't parse the AI's reply",
      noResultReturned: "The AI didn't return a result",
    },
    fetchList: {
      tooManyPages: (maxPages: number, totalPages: number) =>
        `Reading the list went past ${maxPages} pages without finishing (expected around ${totalPages}) — this looks like a server error, so it was stopped`,
    },
    moves: {
      interrupted: "Interrupted — it isn't clear whether this batch was written; please check on Bilibili and retry",
      copyNotRemoved: (message: string) => `Copy not removed: ${message}`,
    },
    cover: { downloadFailed: (status: number) => `Cover download failed, HTTP ${status}` },
    subtitle: { downloadFailed: (status: number) => `Subtitle download failed, HTTP ${status}` },
    imageReadFailed: 'Failed to read image',
    headerRuleFailed: (message: string) =>
      `Couldn't install the Referer/Origin rule — requests to api.bilibili.com will be blocked: ${message}`,
  },

  // ---- Progress labels produced in src/core (shown in the review table / progress panel) ----
  progress: {
    detailCacheStatus: (cached: number, total: number) => `Details: ${cached} cached, ${total} to fetch`,
    detailProgress: (i: number, total: number, title: string) => `Details ${i}/${total}: ${title}`,
    subtitleProgress: (i: number, total: number, title: string) => `Subtitles ${i}/${total}: ${title}`,
    listPage: (pn: number) => `Reading list, page ${pn}`,
    listDone: (n: number) => `List read, ${n} videos`,
    moveBack: 'Move back to source',
    removeCopy: 'Remove copy',
    undoBatch: (label: string, i: number, total: number, n: number) => `${label} ${i}/${total} (${n} videos)`,
    undoDone: (n: number, failed: number) => `Done: undid ${n}, ${failed} failed`,
    moveBatch: (op: 'copy' | 'move', i: number, total: number, n: number) =>
      `${op === 'copy' ? 'Copying' : 'Moving'} batch ${i}/${total} (${n} videos)`,
    moveDone: (moved: number, copied: number, failed: number): string => {
      const parts = [...(copied > 0 && moved === 0 ? [] : [`moved ${moved}`]), ...(copied > 0 ? [`copied ${copied}`] : [])];
      return `Done: ${parts.join(', ')}, ${failed} failed`;
    },
    removeBatch: (i: number, total: number, n: number) => `Removing batch ${i}/${total} (${n} videos)`,
    removeDone: (removed: number, failed: number) => `Done: removed ${removed}, ${failed} failed`,
    classifyBatch: (label: string, i: number, total: number) => `${label}: batch ${i}/${total}`,
    classifyDone: (label: string) => `${label}: done`,
    coverProgress: (i: number, total: number) => `Covers ${i}/${total}`,
    classify: 'Classify',
    retryingIn: (message: string, seconds: number) => `${message}; retrying automatically in ${seconds}s`,
    stale: 'This video is no longer available',
    staysInPlace: 'Stays in place',
  },

  // ---- Follows page (src/ui/pages/FollowsPage.tsx, src/ui/pages/follows/*, src/core/{fetchFollows,checkActivity,unfollow}.ts) ----
  follows: {
    phase: {
      fetchingFollows: 'Reading follow list',
      checking: 'Checking latest uploads',
      unfollowing: 'Unfollowing',
      restoring: 'Following again',
    },

    prepare: {
      account: 'Account',
      whoFollows: (following: number, whisper: number) =>
        whisper > 0
          ? `Follows ${accounts(following)} · ${whisper.toLocaleString('en-US')} quiet ${whisper === 1 ? 'follow' : 'follows'}`
          : `Follows ${accounts(following)}`,
      statLoading: 'Counting follows…',
      cacheTitle: 'Cached results',
      cacheEmpty: 'Nothing cached yet. The first run asks Bilibili about every account.',
      cacheSummary: (count: number, oldest: string) =>
        `${accounts(count)} already checked, oldest result from ${oldest}. Fresh results are reused.`,
      lastResults: 'Last review',
      lastResultsSummary: (rows: number, when: string) => `${accounts(rows)}, list read ${when}.`,
      backToReview: 'Back to the review table',
      privacyNote:
        'Everything stays in this browser. This page only talks to api.bilibili.com with the login you already have, and writes nothing until you press the button on the review table.',
      title: 'Find the accounts that went quiet',
      desc: 'Reads your follow list, asks Bilibili when each account last uploaded, and puts it all in one table. Nothing is unfollowed on this page.',
      steps: {
        read: {
          title: 'Read your follow list',
          desc: 'Every account you follow, with its groups, special-follow flag and follow date. A few requests per fifty accounts.',
          meter: (follows: number) => accounts(follows),
        },
        check: {
          title: 'Look up each account’s latest upload',
          desc: (ttl: number) =>
            `One request per account at the read rate set in Settings, and it stops by itself if Bilibili starts rate-limiting. Results are cached for ${ttl} days, so the next run only asks about new accounts.`,
          meter: (toCheck: number) => `≈ ${plural(toCheck, 'request')}`,
        },
        review: {
          title: 'Review, tick, unfollow',
          desc: 'Set the inactivity threshold, filter by group or kind of follow, tick the rows, then confirm. Undo is one click away afterwards.',
          meter: 'you decide',
        },
      },
      modeLabel: 'Which accounts to look up',
      modeMissing: 'Only accounts without a fresh result',
      modeMissingNote: (ttl: number) =>
        `Recommended. Reuses results younger than ${ttl} days; accounts that could not be checked last time are retried.`,
      modeAll: 'Every account, again',
      modeAllNote: 'Ignores the cache. Use it when you suspect the cached results are stale.',
      whispersLabel: 'Include quiet follows (悄悄关注)',
      whispersNote: 'Bilibili retired quiet follows but old ones still exist; they are unfollowed with the matching action.',
      start: (n: number) => `Read the list and check ${accounts(n)}`,
      startShort: 'Read the list and check',
      startHint: 'Read-only until you confirm on the review table.',
      estRequests: (n: string) => `≈ ${n} requests`,
      estMinutes: (n: number) => `≈ ${n} min`,
    },

    running: {
      nowRunning: 'Now running',
      step: { read: 'Read follow list', check: 'Check latest uploads', review: 'Review & unfollow' },
      soFar: 'So far',
      followsRead: 'Follows read',
      inactiveSoFar: (threshold: number) => `Quiet for > ${threshold} d`,
      unknownSoFar: 'Could not check',
      couldNotCheck: 'Could not check',
    },

    // Progress labels produced deep in src/core
    progress: {
      followStat: 'Counting follows…',
      followPage: (pn: number, total: number) => `Follow list page ${pn} / ${total}`,
      whisperPage: (pn: number, total: number) => `Quiet follows page ${pn} / ${total}`,
      followDone: (n: number) => `${accounts(n)} read`,
      checkStart: (cached: number, total: number) =>
        `${cached.toLocaleString('en-US')} from cache · ${total.toLocaleString('en-US')} to look up`,
      checkProgress: (_i: number, _total: number, name: string) => name,
      unfollowProgress: (_i: number, _total: number, name: string) => name,
      restoreProgress: (done: number, total: number) => `${done} / ${total} followed again`,
    },

    job: {
      stoppedCancelled: (remaining: number) =>
        `Stopped by you. ${accounts(remaining)} have not been checked yet — they are shown but cannot be selected.`,
      stoppedAuth: (remaining: number, message: string) =>
        `Stopped: ${message}. ${accounts(remaining)} have not been checked. Sign in to Bilibili again, then check the rest.`,
      stoppedRisk: (remaining: number, message: string) =>
        `Stopped early because Bilibili is rate-limiting requests (${message}). ${accounts(remaining)} have not been checked; the results so far are still valid. Try the rest in a while.`,
      writeStopped: (message: string, remaining: number) => `Stopped: ${message}. ${accounts(remaining)} were not touched.`,
    },

    review: {
      title: 'Review and unfollow',
      desc: 'Every row shows the account’s last upload. Tick the ones you are done with — nothing changes until you confirm below.',
      searchLabel: 'Search accounts',
      searchPlaceholder: 'Name or UID…',
      shown: (n: number, total: number) => `${n.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} shown`,
      selectShown: (n: number) => `Tick all ${n.toLocaleString('en-US')} shown`,
      deselectShown: (n: number) => `Untick all ${n.toLocaleString('en-US')} shown`,
      clearSelection: (n: number) => `Clear ${n.toLocaleString('en-US')} ticked`,
      checkRemaining: (n: number) => `Check the remaining ${n.toLocaleString('en-US')} (starts a new run)`,
      thresholdLabel: 'Quiet for more than',
      thresholdUnit: 'days',
      thresholdHint: 'Counted from the newest upload. Refilters at once; nothing is fetched again.',
      statusTitle: 'Status',
      status: {
        all: 'All accounts',
        inactive: 'Quiet past the threshold',
        active: 'Still uploading',
        noVideos: 'No videos at all',
        unknown: 'Could not check',
        done: 'Unfollowed',
        restored: 'Followed again',
        failed: 'Failed',
      },
      kindTitle: 'Kind of follow',
      kind: { any: 'Any', special: 'Special follow', mutual: 'Follows you back', whisper: 'Quiet follow' },
      groupTitle: 'Group',
      anyGroup: 'Any group',
      noGroup: 'No group',
      thisRun: 'This run',
      accounts: 'Accounts',
      checkedNow: 'Looked up',
      fromCache: 'From cache',
      unknownCount: 'Could not check',
      unfollowedCount: 'Unfollowed',
      restoredCount: 'Followed again',
      unfollowedBanner: (n: number) => `Unfollowed ${accounts(n)} in this run. Undo is available until you clear the results.`,
      restoredBanner: (n: number) => `Followed ${accounts(n)} again — their groups came back too.`,
      readAt: (when: string) => `List read ${when}`,
      savedAt: (when: string) => `saved ${when}`,
      noneInactive: (threshold: number, total: number) =>
        `None of the ${total.toLocaleString('en-US')} accounts has been quiet for more than ${threshold} days. Lower the threshold or pick another status on the left.`,
      emptyFiltered: (total: number) => `No rows match these filters (${total.toLocaleString('en-US')} in total).`,
    },

    table: {
      prevPage: 'Previous',
      nextPage: 'Next',
      headers: {
        account: 'Account',
        group: 'Group',
        lastVideo: 'Latest upload',
        daysInactive: 'Days quiet',
        followed: 'Followed on',
        status: 'Status',
      },
      tickLabel: (name: string) => `Select ${name}`,
      openSpace: 'Open the account’s space on Bilibili',
      mutualTag: 'follows you',
      whisperTag: 'quiet',
      specialTag: 'Special follow',
      noVideos: 'No videos',
      noVideosShort: 'Never uploaded',
      unknown: 'Could not check',
      notChecked: 'Not checked yet',
      daysTitle: (days: number) => `${days.toLocaleString('en-US')} days since the latest upload`,
      daysShort: (days: number) => `${days.toLocaleString('en-US')} d quiet`,
      laneHeader: 'Quiet since',
      thresholdCap: (days: number) => `${days.toLocaleString('en-US')} d`,
      playheadLabel: 'Inactivity threshold — drag to change',
      today: 'Today',
      noVideosCell: 'Never',
      state: { quiet: 'Quiet', uploading: 'Uploading', noVideos: 'No videos' },
      cannotSelectUnchecked: 'Not checked yet — cannot be selected',
      cannotSelectUnknown: 'Status unconfirmed — cannot be selected',
      status: {
        pending: '',
        unfollowing: 'Unfollowing…',
        done: 'Unfollowed',
        failed: 'Failed',
        restoring: 'Following again…',
        restored: 'Followed again',
        restoreFailed: 'Could not follow again',
      },
    },

    csv: {
      headers: {
        uid: 'UID',
        name: 'Name',
        group: 'Group',
        daysInactive: 'Days quiet',
        latestVideo: 'Latest upload',
        videoLink: 'Video link',
        space: 'Space',
      },
    },

    runbar: {
      unfollow: (n: number) => `Unfollow ${accounts(n)}`,
      confirmUnfollowText: (n: number) =>
        `Unfollow ${accounts(n)}? They leave your follow list one by one; you can follow them again from this page afterwards.`,
      confirmUnfollow: (n: number) => `Yes, unfollow ${n.toLocaleString('en-US')}`,
      whyNoSelection: 'Tick accounts in the table first. Rows whose status could not be confirmed cannot be ticked.',
      copyUids: (n: number) => `Copy ${n.toLocaleString('en-US')} UIDs`,
      copyUidsHint: 'Comma-separated UIDs of the ticked rows',
      copied: 'Copied',
      downloadCsv: (n: number) => `Download CSV (${n.toLocaleString('en-US')})`,
      downloadCsvHint: 'Name, groups, days quiet and latest upload of the ticked rows',
      undo: (n: number) => `Undo — follow ${n.toLocaleString('en-US')} again`,
      confirmUndoText: (n: number) =>
        `Follow ${accounts(n)} again and put them back in their groups? Quiet follows come back as normal follows; the follow date will be today.`,
      confirmUndo: 'Yes, follow them again',
      retryFailed: (n: number) => `Retry ${n.toLocaleString('en-US')} failed`,
      rerun: 'Check again',
      clearResults: 'Clear results',
      readout: (shown: number, total: number, ticked: number) =>
        `${shown.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} shown · ${ticked.toLocaleString('en-US')} ticked`,
    },

    // Produced in src/core/unfollow.ts
    errors: {
      restoreRejected: 'Bilibili rejected the follow request for this account',
      whisperRestoredAsFollow: 'Was a quiet follow; followed again as a normal follow',
      groupsNotRestored: (message: string) => `Followed again, but the groups could not be restored: ${message}`,
    },
  },

  // ---- Short activity-log labels (src/shared/activity.ts entries, shown in ProgressPanel) ----
  activity: {
    riskControl412: '412 rate limit',
    notJson: 'Response was not JSON',
  },
};

export type Messages = typeof en;
