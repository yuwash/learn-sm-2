# learn-sm-2

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/yuwash/learn-sm-2)

A minimal single-page application demonstrating the [@open-spaced-repetition/sm-2](https://github.com/open-spaced-repetition/sm-2-ts) library. All data is stored in localStorage. It's a flashcard learning tool that implements the SuperMemo 2 (SM-2) algorithm for memorization of flashcards.
(I'm not in any way affiliated with open-spaced-repetition or SuperMemo)

## Features

* CSV import for vocabulary, optionally clearing and replacing existing cards.
* Learning Modes: Choose between "Learn new" to study cards for the first time, "Review due" to practice cards that the algorithm has scheduled for today, or "Eager review" to review cards ahead of schedule.
* View all your imported cards and their next review dates.
* Export and import your learning profile to a JSON file, allowing you to back up and restore your progress.
* Track review history and avoid showing the same card within a few seconds.
* Edit cards directly within the application.
