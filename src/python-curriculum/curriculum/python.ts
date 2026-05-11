// Python Code Academy curriculum
// Beginner-friendly Python lessons for middle-school students.
//
// IMPORTANT — challenge type constraints (driven by validator.ts):
//   - code_run validator only handles `print("literal")` and `print(int +-* int)`.
//   - It does NOT handle `print(variable)` or f-strings — use multiple_choice for those.
//   - Division `/` is excluded — Python returns floats while JS returns ints.
//   - normalise = trim whitespace only (case-sensitive).
//   - validate = exact string match after normalise.

export interface SubLessonChallenge {
  type:            'code_run' | 'multiple_choice' | 'fill_blank' | 'read_only'
  prompt:          string
  starterCode?:    string
  expectedOutput?: string
  options?:        string[]
  correctOption?:  number
  blankAnswer?:    string
  hints:           string[]
  solution:        string
}

export interface SubLesson {
  id:               string
  title:            string
  slug:             string
  tldr:             string
  searchableTerms:  string[]
  explanation:      string[]
  example: {
    code:    string
    output?: string
  }
  challenge:          SubLessonChallenge
  recommendedAfter?:  string
}

export interface LessonGroup {
  id:         string
  title:      string
  subLessons: SubLesson[]
}

// ---------------------------------------------------------------------------
// Group 1 — Introduction
// ---------------------------------------------------------------------------

const GROUP_INTRODUCTION: LessonGroup = {
  id: 'introduction',
  title: 'Introduction',
  subLessons: [
    {
      id:    'intro-what-is-python',
      title: 'What is Python?',
      slug:  'what-is-python',
      tldr:  'Python is a friendly programming language used for websites, games, science, and AI.',
      searchableTerms: ['python', 'programming language', 'code', 'interpreter', 'guido van rossum'],
      explanation: [
        'Python is a programming language. A programming language is a way to give a computer step-by-step instructions, kind of like a recipe tells you how to bake a cake. Python was created in 1991 by a programmer named Guido van Rossum, and it was named after the British comedy group Monty Python (not the snake!).',
        'Python is popular because it reads almost like plain English. Big companies like Google, Netflix, Instagram, and NASA all use Python. People use it to build websites, make video games, analyse data, train artificial intelligence, and even control robots. That is why learning Python is a great first step into coding.',
      ],
      example: {
        code: `# This is a Python program.
# The line below tells the computer to print a message.
print("Hello, world!")`,
        output: 'Hello, world!',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Who created the Python programming language?',
        options: [
          'Bill Gates',
          'Guido van Rossum',
          'Mark Zuckerberg',
          'Steve Jobs',
        ],
        correctOption: 1,
        hints: [
          'Python was created in 1991 in the Netherlands.',
          'The creator named the language after a British comedy group.',
        ],
        solution: 'Guido van Rossum created Python in 1991.',
      },
    },
    {
      id:    'intro-first-program',
      title: 'Your First Program',
      slug:  'first-program',
      tldr:  'Every coder writes "Hello, world!" as their first program to test that everything works.',
      searchableTerms: ['hello world', 'first program', 'print', 'output', 'tradition'],
      explanation: [
        'When you start learning any new programming language, the tradition is to write a tiny program that displays the words "Hello, world!" on the screen. This started in 1972 and has been a coding tradition ever since. It is the simplest way to check that your tools are set up correctly.',
        'In Python, you do this with just one line of code: `print("Hello, world!")`. The word `print` tells the computer to show something on the screen, and the words inside the quotes are what it should show. Once you can run this, you are officially a programmer!',
      ],
      example: {
        code: `# Your very first Python program.
print("Hello, world!")`,
        output: 'Hello, world!',
      },
      challenge: {
        type:           'code_run',
        prompt:         'Write the classic first program: print the message Hello, world! exactly as shown.',
        starterCode:    '# Write your first program below\n',
        expectedOutput: 'Hello, world!',
        hints: [
          'Use the print function followed by parentheses.',
          'Wrap the text in double quotes so Python knows it is a string.',
        ],
        solution: 'print("Hello, world!")',
      },
      recommendedAfter: 'intro-what-is-python',
    },
    {
      id:    'intro-running-python',
      title: 'Running Python Code',
      slug:  'running-python',
      tldr:  'You can run Python in many places: an online editor, a terminal, or a special program called an IDE.',
      searchableTerms: ['run python', 'ide', 'interpreter', 'repl', 'terminal'],
      explanation: [
        'Once you write Python code, the computer needs to actually run it. To run Python you need something called a Python interpreter. An interpreter is a program that reads your code line by line and tells the computer what to do. Think of it like a translator that turns your Python words into a language the computer understands.',
        'There are three common places to run Python. First, in a website editor like Replit or this Flow Academy lesson page. Second, in a terminal window on your computer, where you type `python myfile.py`. Third, inside an IDE — an Integrated Development Environment — which is a special app like VS Code or PyCharm that helps you write code. Beginners usually start with an online editor because nothing needs to be installed.',
      ],
      example: {
        code: `# This file would be saved as hello.py
# In the terminal you would type: python hello.py
print("I am running Python!")`,
        output: 'I am running Python!',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What is a Python interpreter?',
        options: [
          'A person who reads Python books out loud',
          'A program that runs Python code line by line',
          'A type of computer that only runs Python',
          'A special keyboard for programmers',
        ],
        correctOption: 1,
        hints: [
          'It is a piece of software, not a person or hardware.',
          'It translates your code into instructions the computer can follow.',
        ],
        solution: 'A Python interpreter is a program that runs Python code line by line.',
      },
      recommendedAfter: 'intro-first-program',
    },
    {
      id:    'intro-comments',
      title: 'Comments',
      slug:  'comments',
      tldr:  'A comment is a note in your code that the computer ignores. It is written for humans to read.',
      searchableTerms: ['comment', 'hash', 'documentation', 'note', 'pound sign'],
      explanation: [
        'A comment is a line of text in your code that the Python interpreter ignores. Comments are notes for humans — for you when you come back to your code later, or for other people reading it. To create a comment in Python, you put a hash symbol `#` at the start of the line. Everything after the `#` on that line is treated as a comment.',
        'Good programmers use comments to explain why their code does something, not just what it does. For example, instead of writing `# add 1 to score`, a better comment is `# add 1 because the player picked up a coin`. Comments make your code easier to understand and easier to fix later.',
      ],
      example: {
        code: `# This is a comment — Python ignores it.
# The next line actually runs.
print("Comments are helpful!")
# print("This line is hidden.")`,
        output: 'Comments are helpful!',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which symbol starts a comment in Python?',
        options: [
          '// (two slashes)',
          '/* */ (slash star)',
          '# (hash)',
          '-- (two dashes)',
        ],
        correctOption: 2,
        hints: [
          'Other languages use //, but Python uses something different.',
          'It is sometimes called the pound sign or the number sign.',
        ],
        solution: 'A comment in Python starts with the hash symbol #.',
      },
      recommendedAfter: 'intro-running-python',
    },
    {
      id:    'intro-print-function',
      title: 'The print Function',
      slug:  'print-function',
      tldr:  'print() shows messages on the screen. It is the easiest way to see what your program is doing.',
      searchableTerms: ['print', 'function', 'output', 'screen', 'parentheses'],
      explanation: [
        'The `print` function is the most-used tool when you are learning Python. A function is a small machine inside Python that does a job for you. The `print` function\'s job is to display whatever you give it on the screen. You call it by writing `print` followed by parentheses `()`. Anything you put inside the parentheses is what gets shown.',
        'You can print text by wrapping it in quotes — either double quotes `"hello"` or single quotes `\'hello\'` work. You can also print numbers without any quotes, like `print(42)`. Each call to `print` puts its message on its own line, which makes it perfect for showing results or debugging your code.',
      ],
      example: {
        code: `# print can show text...
print("Welcome to Python")
# ...and it can also show numbers.
print(2025)`,
        output: 'Welcome to Python\n2025',
      },
      challenge: {
        type:           'code_run',
        prompt:         'Use print to display the message: I love coding',
        starterCode:    '# Print the message below\n',
        expectedOutput: 'I love coding',
        hints: [
          'Use the print function and put the message in quotes.',
          'The exact text inside the quotes will be shown on the screen.',
        ],
        solution: 'print("I love coding")',
      },
      recommendedAfter: 'intro-comments',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 2 — Variables
// ---------------------------------------------------------------------------

const GROUP_VARIABLES: LessonGroup = {
  id: 'variables',
  title: 'Variables',
  subLessons: [
    {
      id:    'vars-what-is-a-variable',
      title: 'What is a Variable?',
      slug:  'what-is-a-variable',
      tldr:  'A variable is a labelled box that stores a piece of information for your program to use later.',
      searchableTerms: ['variable', 'storage', 'assignment', 'equals sign', 'memory'],
      explanation: [
        'A variable is a name that holds a value. Imagine your computer\'s memory as a big shelf full of boxes. A variable is one of those boxes with a label on the outside. You put a value inside the box, and you write a name on the label so you can find it again later. For example, you might have a box labelled `score` that holds the number `0`.',
        'In Python, you create a variable using the equals sign `=`. The name goes on the left, and the value goes on the right. So `score = 0` means "make a box called score and put the number 0 inside it." After this line, every time Python sees the word `score`, it goes and looks inside the box to find the value.',
      ],
      example: {
        code: `# Create a variable named player_name and store a string inside it.
player_name = "Alex"

# Create another variable called level and store the number 1.
level = 1

print("Player ready!")`,
        output: 'Player ready!',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which line correctly creates a variable named age and stores the number 12 in it?',
        options: [
          'age == 12',
          '12 = age',
          'age = 12',
          'variable age 12',
        ],
        correctOption: 2,
        hints: [
          'The variable name always goes on the left of the equals sign.',
          'A single = is used to assign a value. == means something different.',
        ],
        solution: 'age = 12 creates a variable named age holding the value 12.',
      },
    },
    {
      id:    'vars-naming-variables',
      title: 'Naming Variables',
      slug:  'naming-variables',
      tldr:  'Variable names must follow rules: letters, digits, underscores — no spaces, no starting digit.',
      searchableTerms: ['naming', 'identifier', 'underscore', 'snake_case', 'rules'],
      explanation: [
        'Python has rules for what you can call a variable. The name can only contain letters (a–z, A–Z), digits (0–9), and underscores `_`. It must start with a letter or an underscore — never with a digit. Spaces are not allowed, so programmers use underscores instead. For example, `high_score` is valid but `high score` is not.',
        'Names are case-sensitive, which means `Score`, `score`, and `SCORE` are three different variables. The Python community has a style called snake_case where you write everything in lowercase and separate words with underscores. So `student_age` is preferred over `StudentAge`. Also avoid using Python keywords like `print`, `if`, or `for` as variable names — they are already reserved for special jobs.',
      ],
      example: {
        code: `# Good variable names: clear and snake_case.
first_name = "Sam"
high_score = 9000
is_logged_in = True

# These would be INVALID:
# 2nd_player = "Pat"   # cannot start with a digit
# my name = "Lee"      # cannot contain spaces`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which of these variable names is INVALID in Python?',
        options: [
          'my_score',
          '_total',
          '2player',
          'level1',
        ],
        correctOption: 2,
        hints: [
          'Look closely at the first character of each name.',
          'Python variable names cannot begin with a number.',
        ],
        solution: 'The name 2player is invalid because variable names cannot start with a digit.',
      },
      recommendedAfter: 'vars-what-is-a-variable',
    },
    {
      id:    'vars-changing-variables',
      title: 'Changing Variables',
      slug:  'changing-variables',
      tldr:  'A variable can hold a new value any time. The old value is replaced and forgotten.',
      searchableTerms: ['reassignment', 'update', 'change value', 'mutate', 'overwrite'],
      explanation: [
        'Variables in Python can change. That is actually why they are called "variables" — their value can vary. To change a variable, you simply use the equals sign again with a new value. The old value is thrown away and the new value takes its place. This is called reassignment.',
        'Reassignment is everywhere in real programs. A game keeps a variable called `score` that goes up each time the player collects a coin. A chat app keeps a variable called `message_count` that grows with every new message. The variable name stays the same, but the value inside the box keeps changing.',
      ],
      example: {
        code: `# Start with a score of 0.
score = 0
# The player scores 10 points — update the variable.
score = 10
# They score another 5 — update again.
score = 15
print("Score updated")`,
        output: 'Score updated',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'After these lines, what value is stored in x?\n\nx = 5\nx = 10\nx = 20',
        options: [
          '5',
          '10',
          '20',
          '35',
        ],
        correctOption: 2,
        hints: [
          'Each new assignment replaces the old value.',
          'Only the last value assigned is kept.',
        ],
        solution: 'x is 20 because each new assignment overwrites the previous value.',
      },
      recommendedAfter: 'vars-naming-variables',
    },
    {
      id:    'vars-multiple-variables',
      title: 'Multiple Variables',
      slug:  'multiple-variables',
      tldr:  'You can create several variables at once and use them together in your program.',
      searchableTerms: ['multiple variables', 'multiple assignment', 'tuple unpacking', 'parallel'],
      explanation: [
        'You usually need more than one variable to make something useful. You can create them one per line, like `name = "Sam"` then `age = 12`. Python also lets you assign several variables on one line by separating them with commas: `name, age = "Sam", 12`. This is called multiple assignment and it pairs each name on the left with each value on the right.',
        'A handy shortcut: if you want lots of variables to start with the same value, chain the assignment with equals signs. The line `x = y = z = 0` makes three variables all equal to 0. Be careful, though — change one of them later and the others keep their value. They are independent boxes that just started with the same value.',
      ],
      example: {
        code: `# Three variables created on three lines.
name = "Sam"
age  = 12
city = "London"

# Or all on one line using multiple assignment.
first, second, third = 1, 2, 3
print("Variables ready")`,
        output: 'Variables ready',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'After this line:\n\na, b, c = 10, 20, 30\n\nWhat value does b hold?',
        options: [
          '10',
          '20',
          '30',
          '60',
        ],
        correctOption: 1,
        hints: [
          'The values on the right match up in order with the names on the left.',
          'a gets the first value, b gets the second, c gets the third.',
        ],
        solution: 'b holds 20 because values are paired in order with the variable names.',
      },
      recommendedAfter: 'vars-changing-variables',
    },
    {
      id:    'vars-constants',
      title: 'Constants',
      slug:  'constants',
      tldr:  'A constant is a value that should not change. By convention, constant names are written in ALL_CAPS.',
      searchableTerms: ['constant', 'all caps', 'convention', 'immutable', 'pi'],
      explanation: [
        'A constant is a value that you do not want to change while your program runs. Examples are the number of days in a week, the value of pi, or the maximum score allowed in a game. Python does not actually stop you from changing a constant — there is no special keyword like in some other languages — but programmers agree to follow a convention.',
        'The convention is: write the variable name in ALL CAPITAL LETTERS with underscores between words. For example, `MAX_PLAYERS = 4` or `PI = 3.14159`. When other programmers see ALL_CAPS, they know not to change the value. It is like a sign that says "do not touch." Following this convention makes your code easier to read and trust.',
      ],
      example: {
        code: `# Constants use ALL_CAPS to signal "do not change me".
MAX_PLAYERS = 4
PI = 3.14159
SECONDS_PER_MINUTE = 60

print("Constants defined")`,
        output: 'Constants defined',
      },
      challenge: {
        type:   'fill_blank',
        prompt: 'Fill in the blank to follow the constant naming convention. The variable should hold the maximum number of lives a player can have, set to 3.\n\n_____ = 3',
        blankAnswer: 'MAX_LIVES',
        hints: [
          'Constants are written in ALL CAPITAL LETTERS.',
          'Use an underscore to separate words like MAX and LIVES.',
        ],
        solution: 'MAX_LIVES = 3 follows the all-caps constant convention.',
      },
      recommendedAfter: 'vars-multiple-variables',
    },
  ],
}

// ---------------------------------------------------------------------------
// PYTHON_CURRICULUM — exported aggregate
// ---------------------------------------------------------------------------

export const PYTHON_CURRICULUM: LessonGroup[] = [
  GROUP_INTRODUCTION,
  GROUP_VARIABLES,
]
