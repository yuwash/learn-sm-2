import * as Review from './review.js';
import * as Storage from './storage.js';

// Core logic functions
function onCsvImported(text) {
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
const App = {
  state: { phase: 'idle', mode: null, currentCard: null, fileError: null },

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
      try {
        onCsvImported(ev.target.result);
        App.state.fileError = 'Import successful!';
      } catch (err) {
        App.state.fileError = err.message;
      }
      m.redraw();
    };
    reader.readAsText(file);
  },

  viewNotification() {
    const s = App.state;
    const isIdle = s.phase === 'idle';
    const revealed = s.phase === 'self-grading-revealed';

    return m(
      'article.message',
      { class: s.fileError?.includes('successful') ? 'is-success' : 'is-info' },
      [
        m('div.message-body', [
          m(
            'p.mb-3',
            isIdle
              ? s.fileError ||
                  'Import a CSV file (front,back per line) and start learning!'
              : revealed
              ? 'Grade how well you remembered (0=fail, 5=perfect).'
              : 'Study the front. Click Reveal when ready.'
          ),
          m('div.buttons', [
            isIdle && [
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
            ],
            !isIdle &&
              !revealed &&
              m('button.button.is-link', { onclick: App.reveal }, 'Reveal'),
            revealed && [
              [0, 1, 2, 3, 4, 5].map((q) =>
                m(
                  'button.button.is-success.is-outlined',
                  { onclick: () => App.handleGrade(q) },
                  q
                )
              ),
            ],
            !isIdle &&
              m('button.button.is-ghost', { onclick: App.quitSession }, 'Quit'),
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
    const allCards = Object.values(Review.itemsById)
      .map((card) => {
        const sched = Review.sm2StateById[card.id];
        return {
          ...card,
          dueDate: sched ? new Date(sched.due).toLocaleDateString() : 'never',
          isDue: sched && sched.due <= now,
        };
      })
      .sort(
        (a, b) =>
          new Date(Review.sm2StateById[a.id]?.due || 0) -
          new Date(Review.sm2StateById[b.id]?.due || 0)
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
      App.state.phase === 'idle' ? App.viewCardList() : App.viewCardArea(),
    ]);
  },
};

Storage.loadState();
m.mount(document.getElementById('app'), App);
