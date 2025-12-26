import * as Review from './review.js';
import * as Storage from './storage.js';

// Core logic functions
function onCsvImported(text, replace = false) {
  if (replace) {
    Storage.clearState();
  }
  const parsedData = Review.parseCsv(text);
  Review.extendItemsById(parsedData);
  Storage.saveState();
}

function getNextCard(mode) {
  const dueItems = Review.getDueItems(mode);
  return dueItems.length > 0 ? dueItems[0] : null;
}

function gradeCurrentCard(id, quality) {
  Review.sm2Review(id, quality);
  Storage.saveState();
}

// ===== MITHRIL COMPONENT =====
const gradeButton = (quality) => {
  const color =
    quality < 3 ? 'is-danger' : quality < 4 ? 'is-warning' : 'is-success';
  return m(
    `button.button.${color}.is-outlined`,
    { onclick: () => App.handleGrade(quality) },
    quality
  );
};

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

  loadNextCard(mode) {
    return getNextCard(mode);
  },

  startSession(mode) {
    const card = App.loadNextCard(mode);
    if (!card) {
      App.state.fileError = `No cards available for ${mode}.`;
      m.redraw();
      return;
    }
    App.state.phase = 'self-grading';
    App.state.mode = mode;
    App.state.currentCard = card;
    App.state.fileError = null;
  },

  quitSession() {
    App.state.phase = 'idle';
    App.state.mode = null;
    App.state.currentCard = null;
  },

  reveal() {
    if (App.state.phase === 'self-grading') {
      App.state.phase = 'self-grading-revealed';
    }
  },

  handleGrade(quality) {
    if (!App.state.currentCard) return;
    gradeCurrentCard(App.state.currentCard.id, quality);
    const next = App.loadNextCard(App.state.mode);
    if (!next) {
      App.quitSession();
      App.state.fileError = 'No more cards due in this session.';
      m.redraw();
      return;
    }
    App.state.currentCard = next;
    App.state.phase = 'self-grading';
    m.redraw();
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
      App.state.phase = 'idle';
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
    const isIdle = App.state.phase === 'idle';
    const isEdit = App.state.phase === 'edit';
    const revealed = App.state.phase === 'self-grading-revealed';
    const isReviewing = App.isReviewing();

    return (isIdle || isEdit)
    ? App.state.fileError ||
        'Import a CSV file (front,back per line) and start learning!'
    : revealed
    ? 'Grade how well you remembered (0=fail, 5=perfect).'
    : isReviewing ? 'Study the front. Click Reveal when ready.'
    : ''
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
                App.state.phase = (isEdit || showingHistory) ? 'idle' : 'edit';
            }
        }
      }, m('span.material-icons', (isEdit || isReviewing || showingHistory) ? 'arrow_back' : 'edit'));
  },

  viewNotification() {
    const s = App.state;
    const isIdle = s.phase === 'idle';
    const isEdit = s.phase === 'edit';
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
                'button.button.is-light',
                {
                  onclick: () => App.state.phase = 'history',
                  title: 'Show review history'
                },
                m('span.material-icons', 'history')
              ),
            ],
            isReviewing &&
              !revealed &&
              m('button.button.is-link', { onclick: App.reveal }, 'Reveal'),
            revealed && [
              [0, 1, 2, 3, 4, 5].map(gradeButton),
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

  viewCardList() {
    const now = Date.now();
    const allCards = Object.values(Review.state.itemsById)
      .map((card) => {
        const dueDate = Review.getCardDueDate(card.id);
        return {
          ...card,
          dueDate: dueDate ? dueDate.toLocaleDateString() : 'never',
          isDue: dueDate && dueDate.getTime() <= now,
        };
      })
      .sort(
        (a, b) =>
          (Review.getCardDueDate(a.id) || 0) - (Review.getCardDueDate(b.id) || 0)
      );

    if (allCards.length === 0)
      return m('div.notification', 'No cards imported yet.');

    return m('div', [
      m('h2.title.is-5.mb-3', `${allCards.length} cards total`),
      allCards.map((card) =>
        m(
          'div.box.p-3.mb-2' + (card.isDue ? '.has-background-primary-light' : ''),
          {
            style: `border-left: .3em solid ${
              card.isDue ? 'darkblue' : 'grey'
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
                  m('span.is-family-monospace.is-size-7', card.dueDate)
                )
              ),
            ]),
          ]
        )
      ),
    ]);
  },

  view() {
    return m('div', [
      App.viewNotification(),
      App.isReviewing()
        ? App.viewCardArea()
        : App.viewCardList(),
    ]);
  },
};

Storage.loadState();
if (Object.keys(Review.state.itemsById).length === 0) {
  App.state.phase = 'edit';
}
m.mount(document.getElementById('app'), App);
