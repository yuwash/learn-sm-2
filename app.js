import * as Review from './review.js';
import * as Storage from './storage.js';

const extraEasyExtraProgress = 3;  // About 100 days

// Core logic functions
function onCsvImported(text, replace = false) {
  if (replace) {
    Storage.clearState();
  }
  const parsedData = Review.parseCsv(text);
  Review.extendItemsById(parsedData);
  Storage.saveState();
}

function gradeCurrentCard(id, quality, extraProgress, eager) {
  Review.sm2Review(id, quality, extraProgress, eager);
  Storage.saveState();
}

function exportProfile() {
  // The Card objects in sm2StateById have a toJSON method, so JSON.stringify should work.
  const data = JSON.stringify(Review.state, null, 2); // pretty print JSON
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'learn-cards-profile.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadProfile() {
  if (!confirm('This will replace all your current data. Are you sure?')) {
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        Review.setItemsById(data.itemsById);
        Review.setSm2StateById(data.sm2StateById);
        Review.state.history = data.history;
        Storage.saveState();
        App.state.fileError = 'Profile loaded successfully!';
        m.redraw();
      } catch (err) {
        App.state.fileError = 'Error loading profile: ' + err.message;
        m.redraw();
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== MITHRIL COMPONENT =====
const gradeButton = (quality, extraProgress, icon, iconTitle) => {
  const color =
    quality < 3 ? 'is-danger' : quality < 4 ? 'is-warning' : 'is-success';
  const inner = icon ? m('span.material-icons', { title: iconTitle }, icon) : quality;
  return m(
    `button.button.${color}.is-outlined`,
    { onclick: () => App.handleGrade(quality, extraProgress) },
    inner
  );
};

const clearHistoryButton = () => (
  m('button.button.is-danger', {
    onclick: () => {
      if (confirm('Are you sure you want to clear history? It won’t affect learning progress.')) {
        Review.clearHistory();
        Storage.saveState();
      }
    },
  }, 'Clear History')
);

const App = {
  state: {
    phase: 'idle',
    mode: null,
    currentCard: null,
    fileError: null,
    csvData: '',
    replacingImport: false,
  },

  isReviewing() {
    const p = App.state.phase;
    return p === 'self-grading' || p === 'self-grading-revealed';
  },

  setPhase(phase) {
    App.state.phase = phase;
    App.state.fileError = null;
    m.redraw();
  },

  loadNextCard(mode) {
    return Review.getNextDueItem(mode);
  },

  startSession(mode) {
    const card = App.loadNextCard(mode);
    if (!card) {
      App.state.fileError = `No cards available for ${mode}.`;
      m.redraw();
      return;
    }
    App.setPhase('self-grading');
    App.state.mode = mode;
    App.state.currentCard = card;
    App.state.fileError = null;
  },

  quitSession() {
    App.setPhase('idle');
    App.state.mode = null;
    App.state.currentCard = null;
  },

  reveal() {
    if (App.state.phase === 'self-grading') {
      App.setPhase('self-grading-revealed');
    }
  },

  handleGrade(quality, extraProgress) {
    if (!App.state.currentCard) return;
    const eager = App.state.mode === 'review-eager';
    gradeCurrentCard(App.state.currentCard.id, quality, extraProgress, eager);
    const next = App.loadNextCard(App.state.mode);
    if (!next) {
      App.quitSession();
      App.state.fileError = 'No more cards due in this session.';
      m.redraw();
      return;
    }
    App.state.currentCard = next;
    App.setPhase('self-grading');
  },

  handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      App.state.csvData = ev.target.result;
      App.handleCsvImport();
      m.redraw();
    };
    reader.readAsText(file);
  },

  handleCsvImport() {
    try {
      onCsvImported(App.state.csvData, App.state.replacingImport);
      App.state.fileError = 'Import successful!';
      App.state.csvData = '';
      App.setPhase('idle');
    } catch (err) {
      App.state.fileError = err.message;
    }
  },

  toggleReplacingImport(e) {
    const isChecked = e.target.checked;
    App.state.replacingImport = isChecked;
    if (isChecked) {
      alert('Warning: Turning on "Clear and replace" will erase all your existing learning progress before importing new cards.');
    }
    m.redraw();
  },

  statusMessage() {
    const messages = [];
    const isEdit = App.state.phase === 'edit';
    const showingHistory = App.state.phase === 'history';
    const revealed = App.state.phase === 'self-grading-revealed';
    const isReviewing = App.isReviewing();

    if (App.state.fileError) {
      messages.push(App.state.fileError);
    }
    const help = isEdit
    ? 'Import a CSV file (front,back per line) and start learning!'
    : showingHistory
    ? 'Showing review history, ordered by most recent.'
    : revealed
    ? 'Grade how well you remembered (0=fail, 5=perfect).'
    : isReviewing ? 'Study the front. Click Reveal when ready.'
    : '';
    if (help) {
      messages.push(help);
    }
    return messages.join(' ');
  },

  viewPhaseSwitch() {
    const isEdit = App.state.phase === 'edit';
    const showingHistory = App.state.phase === 'history';
    const isReviewing = App.isReviewing();
    const title = (
      isEdit ? 'Back to learning'
      : isReviewing ? 'Quit review'
      : showingHistory ? 'Close history'
      : 'Edit cards'
    );

    return m('button.button.is-rounded', {
        title,
        onclick: () => {
            if (isReviewing) {
                App.quitSession();  // phase -> 'idle'.
            } else {
                App.setPhase((isEdit || showingHistory) ? 'idle' : 'edit');
            }
        }
      }, m('span.material-icons', (isEdit || isReviewing || showingHistory) ? 'arrow_back' : 'edit'));
  },

  viewNotification() {
    const s = App.state;
    const isIdle = s.phase === 'idle';
    const isEdit = s.phase === 'edit';
    const showingHistory = s.phase === 'history';
    const isReviewing = App.isReviewing();
    const revealed = s.phase === 'self-grading-revealed';

    return m(
      'article.message',
      { class: s.fileError?.includes('successful') ? 'is-success' : 'is-info' },
      [
        m('div.message-body', [
          m('p.mb-3', App.statusMessage()),
          m('div.buttons.is-flex.is-justify-content-space-between', [
          m('div.buttons.mb-0', [ // Wrapper for left-aligned buttons.
            isEdit && [
              m('div.field.is-grouped.mb-0', [
                m('div.file.is-link.mb-0', [
                  m('label.file-label', [
                    m('input.file-input', {
                      type: 'file',
                      accept: '.csv',
                      onchange: App.handleFileChange,
                    }),
                    m('span.file-cta', m('span.file-label', 'Import CSV')),
                  ]),
                ]),
                m('div.control.dropdown.is-hoverable.is-right', [
                  m('div.dropdown-trigger', [
                    m('button.button', { 'aria-haspopup': 'true', 'aria-controls': 'dropdown-menu', title: 'More options' }, [
                      m('span.material-icons', 'more_vert')
                    ])
                  ]),
                  m('div.dropdown-menu', { id: 'dropdown-menu', role: 'menu' }, [
                    m('div.dropdown-content', [
                      m('div.dropdown-item', [
                        m('textarea.textarea', {
                          placeholder: 'front,back',
                          value: App.state.csvData,
                          oninput: (e) => (App.state.csvData = e.target.value),
                        }),
                        m('button.button.my-2', { onclick: App.handleCsvImport }, 'Import from text'),
                        m('div.field', [
                          m('input#clearAndReplace[type="checkbox"]', {
                            checked: App.state.replacingImport,
                            onchange: App.toggleReplacingImport,
                          }),
                          m('label.checkbox', { for: 'clearAndReplace' }, 'Clear and replace'),
                        ]),
                      ])
                    ])
                  ])
                ])
              ]),
            ],
            isIdle && [
              m(
                'button.button.is-link.is-light',
                { onclick: () => App.startSession('learn') },
                'Learn new'
              ),
              m(
                'button.button.is-link.is-light',
                { onclick: () => App.startSession('review') },
                'Review due'
              ),
              m(
                'button.button.is-link.is-light',
                { onclick: () => App.startSession('review-eager') },
                'Eager review'
              ),
              m(
                'button.button.is-light',
                {
                  onclick: () => App.setPhase('history'),
                  title: 'Show review history'
                },
                m('span.material-icons', 'history')
              ),
            ],
            showingHistory && [
              clearHistoryButton(),
              m('button.button.is-link', { onclick: exportProfile }, 'Export Profile'),
              m('button.button.is-warning', { onclick: loadProfile }, 'Load Profile'),
            ],
            isReviewing &&
              !revealed &&
              m('button.button.is-link', { onclick: App.reveal }, 'Reveal'),
            revealed && [
              [0, 1, 2, 3, 4, 5].map(
                quality => gradeButton(quality)  // optional parameters unfilled
              ),
              gradeButton(5, extraEasyExtraProgress, 'cake', 'Extra easy'),
            ],
            ]),
            App.viewPhaseSwitch() // Added here
          ]),
        ]),
      ]
    );
  },

  viewCardArea() {
    const card = App.state.currentCard;
    const revealed = App.state.phase === 'self-grading-revealed';

    return m('div.block', [
      // Front Card
      m(
        'div.box.has-text-centered.is-size-4.has-border-link',
        {
          style:
            'border-top: .3em solid skyblue; justify-content: center;',
        },
        card ? card.front : 'No card'
      ),
      // Back Card
      revealed &&
        m(
          'div.box.has-text-centered.is-size-4.has-background-success-90',
          {
            style:
              'border-top: .3em solid limegreen; justify-content: center;',
          },
          card.back
        ),
    ]);
  },

  viewCardList(cards) {
    return m('div', [
      m('h2.title.is-5.mb-3', `${cards.length} cards total`),
      cards.map((card) =>
        m(
          'div.box.p-3.mb-2' + (card.isPrimary ? '.has-background-primary-light' : ''),
          {
            style: `border-left: .3em solid ${
              card.isPrimary ? 'darkblue' : 'grey'
            }`,
          },
          [
            m('div.level.is-mobile', [
              m(
                'div.level-left',
                m(
                  'div.level-item',
                  m('span.has-text-weight-medium', card.front)
                )
              ),
              m(
                'div.level-right',
                m(
                  'div.level-item',
                  m(
                    'span.is-family-monospace.is-size-7',
                    { title: card.date?.toLocaleTimeString() },
                    card.date?.toLocaleDateString()
                  )
                )
              ),
            ]),
          ]
        )
      ),
    ]);
  },

  viewStateCardList() {
    const now = Date.now();
    const allCards = Object.values(Review.state.itemsById)
      .map((card) => {
        const dueDate = Review.getCardDueDate(card.id);
        return {
          ...card,
          date: dueDate,
          isPrimary: dueDate && dueDate.getTime() <= now,
        };
      })
      .sort(
        (a, b) =>
          (Review.getCardDueDate(a.id) || 0) - (Review.getCardDueDate(b.id) || 0)
      );

    if (allCards.length === 0)
      return m('div.notification', 'No cards imported yet.');

    return App.viewCardList(allCards);
  },

  viewHistoryCardList() {
    if (!Review.state.history || Review.state.history.length === 0) {
      return m('div.notification', 'No review history yet.');
    }

    const cards = Review.state.history.map(
      ({ cardId, reviewedAt }) => ({
        ...Review.state.itemsById[cardId],
        date: reviewedAt,
      })
    ).reverse(); // Show newest first

    return App.viewCardList(cards);
  },

  view() {
    const showingHistory = App.state.phase === 'history';
    return m('div', [
      App.viewNotification(),
      App.isReviewing()
        ? App.viewCardArea()
        : showingHistory
        ? App.viewHistoryCardList()
        : App.viewStateCardList(),
    ]);
  },
};

Storage.loadState();
if (Object.keys(Review.state.itemsById).length === 0) {
  App.setPhase('edit');
}
m.mount(document.getElementById('app'), App);
