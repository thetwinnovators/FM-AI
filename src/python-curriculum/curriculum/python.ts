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
// Group 3 — Data Types
// ---------------------------------------------------------------------------

const GROUP_DATA_TYPES: LessonGroup = {
  id: 'data-types',
  title: 'Data Types',
  subLessons: [
    {
      id:    'types-integers',
      title: 'Integers',
      slug:  'integers',
      tldr:  'An integer is a whole number — positive, negative, or zero — with no decimal point.',
      searchableTerms: ['integer', 'int', 'whole number', 'number', 'numeric'],
      explanation: [
        'An integer is a whole number. That means it has no decimal point and no fractional part. Examples are `0`, `1`, `42`, `-7`, and `1000000`. In Python, integers are a built-in data type called `int`. A data type is just a category that tells Python what kind of value you are working with — integers, words, true/false, and so on.',
        'You write an integer in Python by just typing the digits, with no quotes around them. Quotes would turn it into text. So `score = 100` stores the integer 100, but `score = "100"` stores the text "100" — which looks the same to humans but behaves very differently. You will see why this matters when we start doing maths.',
      ],
      example: {
        code: `# Integers — whole numbers, no decimal point, no quotes.
high_score = 9000
lives_left = 3
temperature = -5
print(high_score)`,
        output: '9000',
      },
      challenge: {
        type:           'code_run',
        prompt:         'Print the result of the integer expression 7 + 8.',
        starterCode:    '# Print the sum below\n',
        expectedOutput: '15',
        hints: [
          'Use print and put the math expression inside the parentheses.',
          'Do not use quotes around the numbers — that would make them text instead of integers.',
        ],
        solution: 'print(7 + 8)',
      },
    },
    {
      id:    'types-floats',
      title: 'Floats',
      slug:  'floats',
      tldr:  'A float is a number with a decimal point, used for measurements and fractions.',
      searchableTerms: ['float', 'decimal', 'floating point', 'fraction', 'real number'],
      explanation: [
        'A float is a number with a decimal point. The name comes from "floating point", which is the way computers store these numbers. Examples are `3.14`, `0.5`, `-2.7`, and `1.0`. Even `1.0` is a float, not an integer, because it has the decimal point. Floats are useful for measurements like height, weight, or money, where whole numbers are not precise enough.',
        'Floats are not always perfectly exact. Because computers store them in binary, you can sometimes see tiny rounding errors like `0.1 + 0.2` giving `0.30000000000000004`. This is normal for almost every programming language. For most school and game projects, floats are accurate enough. When you really need perfect decimals (like with money), Python has special tools, but for now, floats are fine.',
      ],
      example: {
        code: `# Floats — numbers with a decimal point.
price = 9.99
height_m = 1.65
pi = 3.14159
print(price)`,
        output: '9.99',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which of the following is a float in Python?',
        options: [
          '42',
          '"3.14"',
          '3.14',
          '"hello"',
        ],
        correctOption: 2,
        hints: [
          'A float has a decimal point in it.',
          'A value wrapped in quotes is a string, not a number.',
        ],
        solution: '3.14 is a float because it has a decimal point and is not in quotes.',
      },
      recommendedAfter: 'types-integers',
    },
    {
      id:    'types-strings-intro',
      title: 'Strings (Intro)',
      slug:  'strings-intro',
      tldr:  'A string is text — letters, numbers, or symbols — wrapped in quotes.',
      searchableTerms: ['string', 'text', 'str', 'quotes', 'characters'],
      explanation: [
        'A string is a piece of text. The word comes from "string of characters" — a row of letters, digits, or symbols joined together. In Python, you create a string by wrapping the text in quotes. You can use double quotes `"hello"` or single quotes `\'hello\'` — both work the same way. The official data type is called `str`.',
        'Strings can contain anything, even numbers and symbols. For example, `"42"` is a string, not an integer, because the digits are inside quotes. A phone number, an email address, a player\'s name, the title of a song — these are all strings. Without quotes, Python would think you are referring to a variable name and would get confused. So whenever you see quotes in Python code, you are looking at a string.',
      ],
      example: {
        code: `# Strings — text wrapped in quotes.
name = "Alex"
greeting = 'Hello there!'
phone = "555-1234"
print(greeting)`,
        output: 'Hello there!',
      },
      challenge: {
        type:           'code_run',
        prompt:         'Print the string: Python is fun',
        starterCode:    '# Print the string below\n',
        expectedOutput: 'Python is fun',
        hints: [
          'Wrap the words in quotes so Python knows they are a string.',
          'Use the print function to display the string.',
        ],
        solution: 'print("Python is fun")',
      },
      recommendedAfter: 'types-floats',
    },
    {
      id:    'types-booleans',
      title: 'Booleans',
      slug:  'booleans',
      tldr:  'A boolean is a value that is either True or False — perfect for yes/no situations.',
      searchableTerms: ['boolean', 'bool', 'true', 'false', 'logic'],
      explanation: [
        'A boolean is a data type with only two possible values: `True` or `False`. They are named after George Boole, a mathematician from the 1800s who invented boolean logic. Booleans are perfect for any yes/no, on/off, or right/wrong question. Is the player alive? Is the door locked? Is it raining? Each of these is a True or False question.',
        'In Python, you write the words `True` and `False` exactly like that — with a capital first letter and no quotes. Quotes would turn them into strings. Booleans become very important when you start writing decisions in your code, like "if the score is greater than 100, show a high score message." Without booleans, programs could not make choices.',
      ],
      example: {
        code: `# Booleans — only True or False, capital first letter.
is_logged_in = True
game_over = False
has_key = True
print(is_logged_in)`,
        output: 'True',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which of these is a valid Python boolean value?',
        options: [
          'true',
          'TRUE',
          'True',
          '"True"',
        ],
        correctOption: 2,
        hints: [
          'Python booleans are case-sensitive — only one form is valid.',
          'No quotes are needed around a boolean.',
        ],
        solution: 'True is the valid Python boolean — capital T and no quotes.',
      },
      recommendedAfter: 'types-strings-intro',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 4 — Strings
// ---------------------------------------------------------------------------

const GROUP_STRINGS: LessonGroup = {
  id: 'strings',
  title: 'Strings',
  subLessons: [
    {
      id:    'str-string-basics',
      title: 'String Basics',
      slug:  'string-basics',
      tldr:  'Strings can use single or double quotes. Use the other kind when you need quotes inside the text.',
      searchableTerms: ['string', 'single quotes', 'double quotes', 'escape', 'apostrophe'],
      explanation: [
        'Python is flexible about quotes. You can wrap a string in single quotes `\'Sam\'` or double quotes `"Sam"` — they are equivalent. The trick is to be consistent and to pick the type that does not appear inside your string. For example, to write a string that contains an apostrophe like `it\'s` you should wrap it in double quotes: `"it\'s sunny"`. The double quotes mark the start and end, and the apostrophe in the middle is just text.',
        'Python also has triple-quoted strings, written with three quotes in a row, like `"""hello"""`. These can span multiple lines and are often used for big chunks of text or documentation. For now, stick with single or double quotes — they handle most everyday situations.',
      ],
      example: {
        code: `# Single and double quotes both work.
name = 'Alex'
city = "London"
# Use double quotes when the text has an apostrophe.
phrase = "it's a sunny day"
print(phrase)`,
        output: "it's a sunny day",
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which of these strings would cause an error in Python?',
        options: [
          '"hello world"',
          "'hello world'",
          "'it's mine'",
          '"it\'s mine"',
        ],
        correctOption: 2,
        hints: [
          'Look for a string where the apostrophe inside ends the string early.',
          'When the outer quote matches a quote inside, Python gets confused.',
        ],
        solution: "'it's mine' is invalid because the apostrophe ends the string early.",
      },
    },
    {
      id:    'str-string-concatenation',
      title: 'String Concatenation',
      slug:  'string-concatenation',
      tldr:  'You can join strings with the + operator to make a bigger string.',
      searchableTerms: ['concatenation', 'plus operator', 'join strings', 'combine', 'add strings'],
      explanation: [
        'Concatenation is a fancy word for joining strings together. In Python, you use the plus sign `+` between strings to glue them. For example, `"Hello, " + "Sam"` produces the string `"Hello, Sam"`. The plus sign with numbers adds them, but with strings it joins them. This is one of the same symbols doing two different jobs depending on the data type.',
        'Be careful: you can only concatenate strings with other strings. If you try `"score is " + 100` you will get an error, because Python cannot join a string with an integer. To fix this you need to first convert the number to a string using the `str()` function: `"score is " + str(100)`. We will see more about converting types in a later lesson.',
      ],
      example: {
        code: `# Joining strings with the + operator.
first = "Hello, "
second = "world"
greeting = first + second
# greeting now holds "Hello, world"
print(greeting)`,
        output: 'Hello, world',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What is the value of result after this code runs?\n\na = "fun"\nb = "time"\nresult = a + b',
        options: [
          'fun time',
          'funtime',
          'fun+time',
          'fun, time',
        ],
        correctOption: 1,
        hints: [
          'The + operator joins the strings exactly as they are.',
          'It does not add a space between them automatically.',
        ],
        solution: 'result is "funtime" because + joins strings with no spaces added.',
      },
      recommendedAfter: 'str-string-basics',
    },
    {
      id:    'str-string-length',
      title: 'String Length',
      slug:  'string-length',
      tldr:  'The len() function tells you how many characters are in a string, including spaces.',
      searchableTerms: ['length', 'len', 'count characters', 'size', 'measure'],
      explanation: [
        'The `len` function tells you how long a string is. You pass the string into the parentheses, and Python counts every character — letters, digits, spaces, and punctuation. So `len("hello")` returns `5`, and `len("hi there")` returns `8` because the space and every letter count.',
        'Knowing the length of a string is useful in lots of situations. You might check that a password is at least 8 characters, or warn the user if their username is too long. `len` also works on lists, which we will see later. Whenever you want to ask "how many?", `len` is your friend.',
      ],
      example: {
        code: `# len counts every character including spaces.
word = "Python"
size = len(word)
# size now holds 6
phrase = "hi there"
print(len(phrase))`,
        output: '8',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What is the value of len("hello world")?',
        options: [
          '10',
          '11',
          '12',
          '2',
        ],
        correctOption: 1,
        hints: [
          'Count every single character — including the space between the words.',
          '5 letters + 1 space + 5 letters.',
        ],
        solution: 'len("hello world") is 11 because the space counts as a character.',
      },
      recommendedAfter: 'str-string-concatenation',
    },
    {
      id:    'str-string-methods',
      title: 'String Methods',
      slug:  'string-methods',
      tldr:  'Strings have built-in methods like .upper() and .lower() that return modified copies.',
      searchableTerms: ['method', 'upper', 'lower', 'capitalize', 'strip'],
      explanation: [
        'A method is a function that belongs to a specific value. You call a method by writing the value, then a dot, then the method name with parentheses. Strings come with lots of handy methods. `"hello".upper()` returns `"HELLO"`. `"WORLD".lower()` returns `"world"`. `"  hi  ".strip()` returns `"hi"` with the extra spaces removed.',
        'String methods do not change the original string — Python strings are immutable, which means they cannot be modified once created. Methods always return a new string. So if you write `name = "alex"` and then `name.upper()`, the variable `name` still holds `"alex"`. To keep the uppercase version, you need to save it: `name = name.upper()`.',
      ],
      example: {
        code: `# Common string methods.
greeting = "Hello"
loud = greeting.upper()
# loud now holds "HELLO"
quiet = greeting.lower()
# quiet now holds "hello"
print(loud)`,
        output: 'HELLO',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What does "Python".lower() return?',
        options: [
          'Python',
          'PYTHON',
          'python',
          'pYTHON',
        ],
        correctOption: 2,
        hints: [
          'The lower method makes every letter lowercase.',
          'It does not change the original string — it returns a new one.',
        ],
        solution: '"Python".lower() returns "python" with every letter in lowercase.',
      },
      recommendedAfter: 'str-string-length',
    },
    {
      id:    'str-string-slicing',
      title: 'String Slicing',
      slug:  'string-slicing',
      tldr:  'Slicing pulls out part of a string using square brackets and index numbers.',
      searchableTerms: ['slicing', 'index', 'substring', 'brackets', 'position'],
      explanation: [
        'Slicing means grabbing part of a string. You use square brackets `[]` after the string and put the position numbers (called indexes) inside. Python starts counting at 0, so the first character is index 0, the second is index 1, and so on. For example, `"Python"[0]` returns `"P"` and `"Python"[1]` returns `"y"`.',
        'You can also take a range with two numbers separated by a colon: `"Python"[0:3]` returns `"Pyt"` — characters from index 0 up to but not including index 3. If you leave a side blank, Python uses the start or end. So `"Python"[2:]` returns `"thon"` (from index 2 to the end), and `"Python"[:3]` returns `"Pyt"` (from the start to index 3).',
      ],
      example: {
        code: `# Slicing — grab parts of a string.
word = "Python"
first = word[0]
# first is "P"
last_three = word[3:]
# last_three is "hon"
print(last_three)`,
        output: 'hon',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What does "rainbow"[0:4] return?',
        options: [
          'rain',
          'rainb',
          'rainbow',
          'ainb',
        ],
        correctOption: 0,
        hints: [
          'Slicing starts at the first number and stops before the second number.',
          'Index 0 to 4 means characters at positions 0, 1, 2, and 3.',
        ],
        solution: '"rainbow"[0:4] returns "rain" — characters 0, 1, 2, and 3.',
      },
      recommendedAfter: 'str-string-methods',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 5 — Numbers
// ---------------------------------------------------------------------------

const GROUP_NUMBERS: LessonGroup = {
  id: 'numbers',
  title: 'Numbers',
  subLessons: [
    {
      id:    'num-arithmetic-operators',
      title: 'Arithmetic Operators',
      slug:  'arithmetic-operators',
      tldr:  'Python uses + - * for addition, subtraction, and multiplication, just like a calculator.',
      searchableTerms: ['arithmetic', 'plus', 'minus', 'multiply', 'operator'],
      explanation: [
        'Python is great at maths. You can use it like a calculator. The plus sign `+` adds, the minus sign `-` subtracts, and the asterisk `*` multiplies. So `5 + 3` is `8`, `10 - 4` is `6`, and `6 * 7` is `42`. These symbols are called arithmetic operators because they perform arithmetic.',
        'You can combine operators in one expression, and Python follows the same order of operations you learned in school: multiplication and division come before addition and subtraction. Use parentheses to control the order if you need to. So `2 + 3 * 4` is `14` (because `3 * 4` is done first), but `(2 + 3) * 4` is `20` (because the parentheses force the addition to happen first).',
      ],
      example: {
        code: `# Basic arithmetic — same as a calculator.
total = 5 + 3
# total is 8
print(10 - 4)
# Multiplication uses the asterisk.
print(6 * 7)`,
        output: '6\n42',
      },
      challenge: {
        type:           'code_run',
        prompt:         'Print the result of 9 * 8 using the print function.',
        starterCode:    '# Print the product below\n',
        expectedOutput: '72',
        hints: [
          'Use the asterisk * for multiplication.',
          'Put the expression directly inside print() with no quotes.',
        ],
        solution: 'print(9 * 8)',
      },
    },
    {
      id:    'num-integer-division',
      title: 'Integer Division',
      slug:  'integer-division',
      tldr:  'Python uses // for integer division, which keeps only the whole-number part of the result.',
      searchableTerms: ['integer division', 'floor division', 'double slash', 'quotient', 'whole number'],
      explanation: [
        'Python has two ways to divide. Regular division uses a single slash `/` and returns a float, even when the result is a whole number. So `10 / 2` gives `5.0`, not `5`. If you only want the whole-number part of the result, use a double slash `//` instead. This is called integer division or floor division because it rounds the result down to the nearest whole number.',
        'For example, `7 // 2` is `3`, not `3.5`, because the leftover half is thrown away. Integer division is useful when you cannot have a fractional answer — like splitting 7 cookies between 2 people, with each person getting 3 whole cookies. With negative numbers, it always rounds down (toward minus infinity), so `-7 // 2` is `-4`, not `-3`.',
      ],
      example: {
        code: `# Integer division throws away the fractional part.
whole = 7 // 2
# whole is 3
cookies = 17 // 5
# cookies is 3
print(whole)`,
        output: '3',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What is the value of 13 // 4?',
        options: [
          '3.25',
          '3',
          '4',
          '13',
        ],
        correctOption: 1,
        hints: [
          'Integer division throws away any decimal part.',
          '13 divided by 4 is 3 with a remainder, so the whole-number answer is 3.',
        ],
        solution: '13 // 4 is 3 — integer division keeps only the whole number.',
      },
      recommendedAfter: 'num-arithmetic-operators',
    },
    {
      id:    'num-modulus',
      title: 'Modulus',
      slug:  'modulus',
      tldr:  'The % operator returns the remainder after dividing — great for checking even/odd numbers.',
      searchableTerms: ['modulus', 'modulo', 'remainder', 'percent sign', 'even odd'],
      explanation: [
        'The percent sign `%` in Python is not actually percent — it is the modulus operator. Modulus gives you the remainder left over after dividing. For example, `10 % 3` is `1`, because 10 divided by 3 is 3 with 1 left over. Likewise, `12 % 5` is `2`, because 12 divided by 5 is 2 with 2 left over.',
        'Modulus is super useful. The classic trick is to check if a number is even or odd: any number `% 2` is `0` if the number is even, and `1` if the number is odd. You can also use modulus to find every Nth item in a sequence, or to wrap a value around (like making a clock that goes back to 0 after reaching 24).',
      ],
      example: {
        code: `# Modulus returns the remainder.
leftover = 10 % 3
# leftover is 1
hours = 25 % 24
# hours is 1 (wraps around like a clock)
print(leftover)`,
        output: '1',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What is the value of 17 % 5?',
        options: [
          '3',
          '2',
          '12',
          '0',
        ],
        correctOption: 1,
        hints: [
          'Find how many times 5 fits into 17, then look at what is left.',
          '5 fits into 17 three times (3 x 5 = 15), and 17 - 15 = 2.',
        ],
        solution: '17 % 5 is 2 — the remainder after dividing 17 by 5.',
      },
      recommendedAfter: 'num-integer-division',
    },
    {
      id:    'num-math-functions',
      title: 'Math Functions',
      slug:  'math-functions',
      tldr:  'Python has built-in functions like abs(), round(), min(), and max() for common maths jobs.',
      searchableTerms: ['math', 'abs', 'round', 'min', 'max', 'builtin'],
      explanation: [
        'Python has handy built-in functions for everyday maths. `abs(x)` gives you the absolute value of x, which means it makes negative numbers positive: `abs(-7)` is `7`. `round(x)` rounds a float to the nearest whole number: `round(3.7)` is `4`. `min(a, b, c, ...)` returns the smallest of the values, and `max(a, b, c, ...)` returns the largest.',
        'For more advanced maths — square roots, sines, cosines, logarithms — Python has a `math` module. You bring it in with `import math` at the top of your file, and then you can use functions like `math.sqrt(25)` (which is `5.0`) or `math.pi` (which is the constant pi). For now, the built-ins like `abs`, `round`, `min`, and `max` cover most beginner needs.',
      ],
      example: {
        code: `# Built-in math functions.
distance = abs(-12)
# distance is 12
nearest = round(3.7)
# nearest is 4
smallest = min(5, 2, 9)
# smallest is 2
print(nearest)`,
        output: '4',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What is the value of max(3, 17, 9, 12)?',
        options: [
          '3',
          '9',
          '12',
          '17',
        ],
        correctOption: 3,
        hints: [
          'The max function returns the largest of the values you give it.',
          'Look through the numbers and pick the biggest.',
        ],
        solution: 'max(3, 17, 9, 12) is 17 — the largest value in the list.',
      },
      recommendedAfter: 'num-modulus',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 6 — Input and Output
// ---------------------------------------------------------------------------

const GROUP_INPUT_OUTPUT: LessonGroup = {
  id: 'input-output',
  title: 'Input and Output',
  subLessons: [
    {
      id:    'io-print-basics',
      title: 'Print Basics',
      slug:  'print-basics',
      tldr:  'print() ends every message with a newline by default, so each print starts a fresh line.',
      searchableTerms: ['print', 'newline', 'output', 'end', 'screen'],
      explanation: [
        'You already know `print` shows text on the screen. Behind the scenes, it does one more thing: it adds a newline at the end. A newline is the invisible character that moves the cursor to the next line. That is why two `print` calls in a row show their messages on two separate lines.',
        'You can change this behaviour with a special option called `end`. By writing `print("hi", end="")` you tell Python not to add a newline. The next `print` will continue on the same line. You will see lots of options like this as you learn — they make `print` flexible enough to handle almost any output you need.',
      ],
      example: {
        code: `# Each print call starts on a new line.
print("First")
print("Second")
# Use end="" to stay on the same line.
print("A", end="")
print("B")`,
        output: 'First\nSecond\nAB',
      },
      challenge: {
        type:           'code_run',
        prompt:         'Use print to display the message: Welcome',
        starterCode:    '# Print the message below\n',
        expectedOutput: 'Welcome',
        hints: [
          'Use print with the message in quotes.',
          'The message inside the quotes is what gets displayed.',
        ],
        solution: 'print("Welcome")',
      },
    },
    {
      id:    'io-print-multiple',
      title: 'Printing Multiple Values',
      slug:  'print-multiple',
      tldr:  'print() can take several values separated by commas and adds a space between them.',
      searchableTerms: ['print multiple', 'comma', 'separator', 'sep', 'arguments'],
      explanation: [
        'You can pass `print` more than one value at a time by separating them with commas. For example, `print("score", 42)` shows `score 42`. By default, Python puts a single space between each value. This is handy when you want to mix text and variables without writing concatenation everywhere.',
        'You can change the separator with the `sep` option. So `print("a", "b", "c", sep="-")` outputs `a-b-c`. You can pass any string as the separator, including an empty string `""` to glue values together with nothing between them. Multiple-value printing is a quick, beginner-friendly way to format simple output.',
      ],
      example: {
        code: `# Multiple values separated by commas.
print("Score:", 100)
print("a", "b", "c")
# A custom separator using sep.
print("2025", "05", "10", sep="-")`,
        output: 'Score: 100\na b c\n2025-05-10',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What does print("hi", "there") display?',
        options: [
          'hithere',
          'hi,there',
          'hi there',
          'hi-there',
        ],
        correctOption: 2,
        hints: [
          'By default, print adds a space between values separated by commas.',
          'The comma in the code is the separator between arguments, not the output.',
        ],
        solution: 'print("hi", "there") displays "hi there" with a space between the words.',
      },
      recommendedAfter: 'io-print-basics',
    },
    {
      id:    'io-input-function',
      title: 'The input Function',
      slug:  'input-function',
      tldr:  'input() pauses the program and waits for the user to type a line of text.',
      searchableTerms: ['input', 'user input', 'keyboard', 'prompt', 'interactive'],
      explanation: [
        'The `input` function lets your program talk back to the user. When Python reaches an `input` call, it stops and waits for the user to type something and press Enter. Whatever they typed is returned as a string. You usually pass a prompt message into `input` so the user knows what to type. For example, `name = input("What is your name? ")` shows the question, waits for typing, then stores the answer in `name`.',
        'There is one important catch: `input` always returns a string, even if the user types a number. If you want to do maths with their input, you have to convert it first. Wrap the call in `int()` for a whole number, like `age = int(input("Your age? "))`. Without the conversion, `"12" + 1` would give a type error because Python cannot add a number to text.',
      ],
      example: {
        code: `# Ask for the user's name and store it.
name = input("What is your name? ")

# Ask for a number and convert it to int.
age = int(input("Your age? "))

# Use the variables.
print("Hello!")`,
        output: 'Hello!',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'When a user types 42 at this prompt:\n\nvalue = input("Enter a number: ")\n\nWhat data type is stored in value?',
        options: [
          'integer',
          'float',
          'string',
          'boolean',
        ],
        correctOption: 2,
        hints: [
          'The input function always returns the same data type.',
          'To turn the answer into a number, you need to wrap input in int() or float().',
        ],
        solution: 'value is a string — input always returns a string, even if it looks like a number.',
      },
      recommendedAfter: 'io-print-multiple',
    },
    {
      id:    'io-formatting-output',
      title: 'Formatting Output',
      slug:  'formatting-output',
      tldr:  'f-strings let you drop variables directly into a string by writing f"...{variable}...".',
      searchableTerms: ['f-string', 'format', 'interpolation', 'template', 'braces'],
      explanation: [
        'An f-string is a special kind of string that lets you insert variables and expressions directly into the text. You write an `f` right before the opening quote, then put any variable in curly braces `{}`. For example, `f"Hello, {name}!"` puts the value of the `name` variable right inside the string. This is much cleaner than using `+` to concatenate.',
        'F-strings can hold any expression inside the braces, not just variables. So `f"Total: {price * quantity}"` works fine. You can even add formatting after a colon — `f"{number:.2f}"` shows a float with exactly two decimal places. F-strings were added in Python 3.6 and are now the most popular way to format output.',
      ],
      example: {
        code: `# F-strings drop variables right into the text.
name = "Alex"
age = 12
greeting = f"Hello {name}, you are {age}!"

# Expressions also work inside the braces.
price = 9.99
qty = 3
total = f"Total: {price * qty}"
print(name)`,
        output: 'Alex',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Given this code:\n\nname = "Sam"\nmessage = f"Hi {name}!"\n\nWhat is stored in message?',
        options: [
          'Hi {name}!',
          'Hi Sam!',
          'f"Hi {name}!"',
          'Hi name!',
        ],
        correctOption: 1,
        hints: [
          'In an f-string, {name} is replaced with the value of the variable.',
          'The variable name holds the value Sam.',
        ],
        solution: 'message is "Hi Sam!" because the f-string puts the value of name into the braces.',
      },
      recommendedAfter: 'io-input-function',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 7 — Conditionals
// ---------------------------------------------------------------------------

const GROUP_CONDITIONALS: LessonGroup = {
  id: 'conditionals',
  title: 'Conditionals',
  subLessons: [
    {
      id:    'cond-if-statement',
      title: 'The if Statement',
      slug:  'if-statement',
      tldr:  'An if statement runs a block of code only when a condition is True.',
      searchableTerms: ['if statement', 'condition', 'branch', 'colon', 'indentation'],
      explanation: [
        'An `if` statement lets your program make a decision. The structure is: the word `if`, then a condition that is either True or False, then a colon `:`, then an indented block of code. The indented code runs only if the condition is True. If the condition is False, Python skips the block entirely and moves on.',
        'Indentation matters in Python — it is how Python knows what is inside the `if` block and what is not. The standard is four spaces. As long as the lines are indented the same way, they all belong to the `if`. The moment a line goes back to no indentation, Python considers the `if` block finished.',
      ],
      example: {
        code: `# The if statement makes a decision.
score = 85

if score > 50:
    # This line only runs because score is greater than 50.
    print("You passed!")

print("Done")`,
        output: 'You passed!\nDone',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What does this code print?\n\nx = 5\nif x > 3:\n    print("big")\nprint("end")',
        options: [
          'big',
          'end',
          'big\\nend',
          'nothing',
        ],
        correctOption: 2,
        hints: [
          'Check whether the condition x > 3 is True or False.',
          'If True, both prints run. If False, only the second print runs.',
        ],
        solution: '5 is greater than 3, so the if block runs and prints "big", then "end" prints after.',
      },
    },
    {
      id:    'cond-else-clause',
      title: 'The else Clause',
      slug:  'else-clause',
      tldr:  'else runs a different block of code when the if condition is False.',
      searchableTerms: ['else', 'otherwise', 'alternative', 'two branches', 'binary'],
      explanation: [
        'The `else` clause is the partner of `if`. It gives you a second block of code to run when the `if` condition is False. The structure is: write your `if` block, then on the next non-indented line write `else:`, then an indented block underneath. Only one of the two blocks ever runs — never both, and never neither.',
        'Together, `if/else` makes your program able to handle both possibilities. For example, "if the player has enough coins, buy the sword, otherwise show an error message." This kind of two-way decision is the foundation of almost every interactive program — games, websites, apps — they all use `if/else` thousands of times.',
      ],
      example: {
        code: `# if/else picks between two outcomes.
age = 10

if age >= 13:
    print("You can sign up.")
else:
    # This runs because 10 is not >= 13.
    print("Too young, sorry.")`,
        output: 'Too young, sorry.',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What does this code print?\n\ntemp = 70\nif temp > 80:\n    print("hot")\nelse:\n    print("cool")',
        options: [
          'hot',
          'cool',
          'hot\\ncool',
          'nothing',
        ],
        correctOption: 1,
        hints: [
          'Check whether 70 is greater than 80.',
          'Only one block runs — the if block or the else block.',
        ],
        solution: '70 is not greater than 80, so the else block runs and prints "cool".',
      },
      recommendedAfter: 'cond-if-statement',
    },
    {
      id:    'cond-elif-clause',
      title: 'The elif Clause',
      slug:  'elif-clause',
      tldr:  'elif lets you check more conditions in order, like asking a series of questions.',
      searchableTerms: ['elif', 'else if', 'chain', 'ladder', 'multiple conditions'],
      explanation: [
        'When you have more than two possibilities, you need `elif`, which is short for "else if". It lets you chain multiple conditions. Python checks them top to bottom and runs the first block whose condition is True. Once one block runs, the rest are skipped — even if a later condition would also be True.',
        'A common pattern is to grade a score. If it is 90 or above, print "A". Else if it is 80 or above, print "B". Else if it is 70 or above, print "C". Else print "F". An optional `else` at the very bottom catches everything that did not match any condition. You can have as many `elif` clauses as you need.',
      ],
      example: {
        code: `# elif chains multiple decisions.
score = 75

if score >= 90:
    print("A")
elif score >= 80:
    print("B")
elif score >= 70:
    # This branch runs.
    print("C")
else:
    print("F")`,
        output: 'C',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What does this code print?\n\nx = 50\nif x > 100:\n    print("huge")\nelif x > 25:\n    print("medium")\nelif x > 10:\n    print("small")\nelse:\n    print("tiny")',
        options: [
          'huge',
          'medium',
          'small',
          'tiny',
        ],
        correctOption: 1,
        hints: [
          'Python checks each condition in order from top to bottom.',
          'It runs the first block where the condition is True, then stops.',
        ],
        solution: '50 is not > 100, but is > 25, so "medium" prints and the rest are skipped.',
      },
      recommendedAfter: 'cond-else-clause',
    },
    {
      id:    'cond-comparison-operators',
      title: 'Comparison Operators',
      slug:  'comparison-operators',
      tldr:  'Use ==, !=, <, >, <=, >= to compare values. They always return True or False.',
      searchableTerms: ['comparison', 'equality', 'equal', 'greater than', 'less than'],
      explanation: [
        'Comparison operators let you compare two values. The result is always a boolean — `True` or `False`. The six comparison operators are: `==` (equal to), `!=` (not equal to), `<` (less than), `>` (greater than), `<=` (less than or equal to), and `>=` (greater than or equal to). Notice that "equal to" is `==`, not `=`. A single `=` is for assignment.',
        'You use these comparisons inside `if` statements all the time. For example, `if age == 18` checks whether age is exactly 18. `if score >= 50` checks whether the score reached the passing mark. Mixing these up is one of the most common beginner mistakes — using `=` (assignment) when you meant `==` (comparison) leads to errors that can be hard to spot.',
      ],
      example: {
        code: `# Comparison operators return True or False.
a = 10
b = 20

result1 = (a == b)
# result1 is False
result2 = (a < b)
# result2 is True
result3 = (a != b)
# result3 is True
print("Compared")`,
        output: 'Compared',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which operator checks if two values are EQUAL?',
        options: [
          '=',
          '==',
          '!=',
          '<>',
        ],
        correctOption: 1,
        hints: [
          'A single = is used to assign a value to a variable.',
          'For comparison, you use a doubled version.',
        ],
        solution: 'The == operator checks equality. A single = is assignment.',
      },
      recommendedAfter: 'cond-elif-clause',
    },
    {
      id:    'cond-logical-operators',
      title: 'Logical Operators',
      slug:  'logical-operators',
      tldr:  'Combine booleans with and, or, and not to build more complex conditions.',
      searchableTerms: ['logical', 'and', 'or', 'not', 'boolean operator'],
      explanation: [
        'Sometimes one condition is not enough. Logical operators let you combine conditions. `and` returns True only if both sides are True. `or` returns True if at least one side is True. `not` flips a boolean — `not True` is `False`, and `not False` is `True`. Notice they are written as English words, not symbols.',
        'A real example: a movie theatre might require `age >= 13 and has_ticket == True`. Both must be True for entry. A coupon might apply if `total > 50 or member == True`. Either condition is enough. Logical operators let your program handle these everyday "both/either/not" decisions with very natural-looking code.',
      ],
      example: {
        code: `# and, or, not combine booleans.
age = 14
has_pass = True

# Both must be True for "and".
if age >= 13 and has_pass:
    print("Welcome!")
else:
    print("Sorry")`,
        output: 'Welcome!',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What does the expression  True and False  evaluate to?',
        options: [
          'True',
          'False',
          'None',
          'Error',
        ],
        correctOption: 1,
        hints: [
          '"and" needs BOTH sides to be True to return True.',
          'If even one side is False, the result is False.',
        ],
        solution: 'True and False is False because "and" requires both sides to be True.',
      },
      recommendedAfter: 'cond-comparison-operators',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 8 — Loops
// ---------------------------------------------------------------------------

const GROUP_LOOPS: LessonGroup = {
  id: 'loops',
  title: 'Loops',
  subLessons: [
    {
      id:    'loop-for-loop',
      title: 'The for Loop',
      slug:  'for-loop',
      tldr:  'A for loop repeats a block of code once for each item in a sequence.',
      searchableTerms: ['for loop', 'iteration', 'repeat', 'sequence', 'in'],
      explanation: [
        'A `for` loop lets you repeat actions for every item in a group. The structure is: `for variable in sequence:` followed by an indented block. The variable takes on each value in turn, and the block runs once per value. For example, `for letter in "hi":` would run the block twice — once with `letter` equal to `"h"` and once with `letter` equal to `"i"`.',
        'For loops save you from writing the same code over and over. Without a loop, printing the letters of "Python" would need six separate `print` calls. With a loop, it takes two lines. Anything you can iterate over — strings, lists, dictionaries — works with a `for` loop. This makes them one of the most powerful tools in Python.',
      ],
      example: {
        code: `# A for loop steps through each character.
for letter in "abc":
    # The block runs three times.
    print(letter)
print("done")`,
        output: 'a\nb\nc\ndone',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'How many times does this loop run?\n\nfor ch in "hello":\n    print(ch)',
        options: [
          '4',
          '5',
          '6',
          '1',
        ],
        correctOption: 1,
        hints: [
          'The loop runs once for each character in the string.',
          'Count the letters in "hello".',
        ],
        solution: 'The loop runs 5 times — once for each of the 5 letters in "hello".',
      },
    },
    {
      id:    'loop-range-function',
      title: 'The range Function',
      slug:  'range-function',
      tldr:  'range() creates a sequence of numbers, perfect for looping a specific number of times.',
      searchableTerms: ['range', 'sequence', 'numbers', 'count', 'iteration'],
      explanation: [
        'The `range` function creates a sequence of numbers without you having to type them all. The most common form is `range(n)`, which produces the numbers `0, 1, 2, ..., n-1`. Notice it stops BEFORE `n`, not at it. So `range(5)` gives `0, 1, 2, 3, 4`. You usually pair `range` with a `for` loop to repeat something a set number of times.',
        'You can also use `range(start, stop)` to choose where to begin, or `range(start, stop, step)` to skip values. `range(2, 8)` gives `2, 3, 4, 5, 6, 7`. `range(0, 10, 2)` gives `0, 2, 4, 6, 8` — every second number. The stop number is always excluded, which can be confusing at first, but you get used to it.',
      ],
      example: {
        code: `# range(5) gives 0, 1, 2, 3, 4.
for i in range(5):
    print(i)
# Loop runs 5 times in total.`,
        output: '0\n1\n2\n3\n4',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'How many numbers does range(3, 8) produce?',
        options: [
          '3',
          '4',
          '5',
          '8',
        ],
        correctOption: 2,
        hints: [
          'range starts at the first number and stops BEFORE the second number.',
          'Count: 3, 4, 5, 6, 7.',
        ],
        solution: 'range(3, 8) produces 5 numbers: 3, 4, 5, 6, 7.',
      },
      recommendedAfter: 'loop-for-loop',
    },
    {
      id:    'loop-while-loop',
      title: 'The while Loop',
      slug:  'while-loop',
      tldr:  'A while loop keeps repeating as long as its condition stays True.',
      searchableTerms: ['while loop', 'condition', 'repeat', 'infinite', 'iteration'],
      explanation: [
        'A `while` loop runs as long as a condition is True. The structure is: `while condition:` followed by an indented block. Python checks the condition before each repeat. If it is True, it runs the block again. If it is False, the loop ends. Use `while` when you do not know in advance how many times you need to repeat — like "keep asking until the user types the right password."',
        'Beware of infinite loops. If the condition never becomes False, the loop runs forever and your program freezes. The most common mistake is forgetting to update the variable used in the condition. Always make sure that something inside the loop will eventually make the condition False — for example, `count = count + 1` so that `while count < 10` will one day become False.',
      ],
      example: {
        code: `# Repeat while count is less than 3.
count = 0
while count < 3:
    print(count)
    # Update the variable to avoid an infinite loop.
    count = count + 1`,
        output: '0\n1\n2',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'How many times does this loop run?\n\nn = 0\nwhile n < 4:\n    print(n)\n    n = n + 1',
        options: [
          '3',
          '4',
          '5',
          'forever',
        ],
        correctOption: 1,
        hints: [
          'The loop runs when n is 0, 1, 2, and 3. It stops when n becomes 4.',
          'Count how many values of n satisfy n < 4.',
        ],
        solution: 'The loop runs 4 times — once each for n = 0, 1, 2, and 3.',
      },
      recommendedAfter: 'loop-range-function',
    },
    {
      id:    'loop-break-statement',
      title: 'The break Statement',
      slug:  'break-statement',
      tldr:  'break instantly exits a loop, even if the condition is still True.',
      searchableTerms: ['break', 'exit loop', 'stop', 'terminate', 'continue'],
      explanation: [
        'The `break` keyword stops a loop immediately. The moment Python reaches `break`, it jumps out of the loop and continues with whatever code comes after. You typically put `break` inside an `if` so it only triggers in a certain situation — for example, "keep looking through the list, and stop the moment you find what you want."',
        'There is also a related keyword called `continue`. Where `break` exits the loop entirely, `continue` only skips the rest of the current iteration and goes to the next one. So if you want to ignore a single bad value but keep looping, use `continue`. If you want to bail out of the whole loop, use `break`. Both are tools for changing the normal flow.',
      ],
      example: {
        code: `# Loop through numbers but stop early at 3.
for i in range(10):
    if i == 3:
        # Break exits the loop immediately.
        break
    print(i)
print("after loop")`,
        output: '0\n1\n2\nafter loop',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What does this loop print?\n\nfor i in range(5):\n    if i == 2:\n        break\n    print(i)',
        options: [
          '0',
          '0\\n1',
          '0\\n1\\n2',
          '0\\n1\\n2\\n3\\n4',
        ],
        correctOption: 1,
        hints: [
          'The loop runs for i = 0, 1, 2... but break exits at i = 2.',
          'When break runs, the print after it does not happen.',
        ],
        solution: 'When i is 0 and 1, those values print. When i is 2, break exits before the print runs.',
      },
      recommendedAfter: 'loop-while-loop',
    },
    {
      id:    'loop-loop-patterns',
      title: 'Loop Patterns',
      slug:  'loop-patterns',
      tldr:  'Common patterns: counting, summing, finding the max — most loop problems use these.',
      searchableTerms: ['pattern', 'counter', 'accumulator', 'sum', 'maximum'],
      explanation: [
        'Loops follow common patterns. The counter pattern uses a variable that starts at 0 and increases by 1 each round: `count = count + 1`. The accumulator pattern adds values into a running total: `total = total + value`. The maximum pattern keeps track of the biggest value seen so far. Once you spot these patterns, lots of loop problems become easier.',
        'A typical accumulator looks like this: start with `total = 0` before the loop, then inside the loop write `total = total + item`. After the loop, `total` holds the sum of every item. The same idea works for counting: start with `count = 0`, then `count = count + 1` whenever you see something you want to count. Practising these patterns is the fastest way to get comfortable with loops.',
      ],
      example: {
        code: `# Accumulator pattern — sum the numbers 1 to 5.
total = 0
for i in range(1, 6):
    total = total + i
# total is 15
print(total)`,
        output: '15',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What is the value of total after this loop?\n\ntotal = 0\nfor i in range(4):\n    total = total + i',
        options: [
          '0',
          '4',
          '6',
          '10',
        ],
        correctOption: 2,
        hints: [
          'range(4) gives 0, 1, 2, 3.',
          'Add them all together: 0 + 1 + 2 + 3.',
        ],
        solution: 'total is 6 because 0 + 1 + 2 + 3 = 6.',
      },
      recommendedAfter: 'loop-break-statement',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 9 — Functions
// ---------------------------------------------------------------------------

const GROUP_FUNCTIONS: LessonGroup = {
  id: 'functions',
  title: 'Functions',
  subLessons: [
    {
      id:    'fn-defining-functions',
      title: 'Defining Functions',
      slug:  'defining-functions',
      tldr:  'A function is a reusable block of code you create with the def keyword.',
      searchableTerms: ['function', 'def', 'define', 'block', 'reusable'],
      explanation: [
        'A function is a block of code you give a name. Once you define a function, you can run that block any time by just calling its name. To define a function in Python, you use the keyword `def`, then the function name, then parentheses `()` and a colon. The code that runs when the function is called goes indented underneath.',
        'Functions help you avoid repeating yourself. If you need to print a welcome banner ten times, you can write it once inside a function called `welcome` and then call `welcome()` ten times. Functions also make your code easier to read because their name tells you what they do. Good function names start with a verb, like `calculate_total` or `print_menu`.',
      ],
      example: {
        code: `# Define a function called greet.
def greet():
    print("Hello there!")

# The function does not run until you call it.
# We will see calling in the next lesson.`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which keyword is used to define a function in Python?',
        options: [
          'function',
          'def',
          'func',
          'define',
        ],
        correctOption: 1,
        hints: [
          'The keyword is a three-letter abbreviation.',
          'Python uses short, lowercase keywords.',
        ],
        solution: 'def is the keyword Python uses to define a function.',
      },
    },
    {
      id:    'fn-calling-functions',
      title: 'Calling Functions',
      slug:  'calling-functions',
      tldr:  'To run a function, write its name followed by parentheses. This is called calling it.',
      searchableTerms: ['call function', 'invoke', 'parentheses', 'run', 'execute'],
      explanation: [
        'Defining a function does not run the code inside it — that only happens when you call the function. To call a function, write its name followed by parentheses, like `greet()`. The parentheses are essential — without them, Python thinks you are referring to the function itself, not running it. You can call a function as many times as you want.',
        'You have already been calling functions throughout these lessons. `print("hello")` calls the print function. `len("hi")` calls the len function. `input("? ")` calls the input function. The pattern is always the same: name, then parentheses, with arguments inside the parentheses if needed. Once you understand calling, every Python feature feels familiar.',
      ],
      example: {
        code: `# Define greet, then call it.
def greet():
    print("Hello!")

# Each call runs the function once.
greet()
greet()
greet()`,
        output: 'Hello!\nHello!\nHello!',
      },
      challenge: {
        type:   'fill_blank',
        prompt: 'Fill in the blank to CALL a function named say_hi.\n\n_____',
        blankAnswer: 'say_hi()',
        hints: [
          'To call a function, write its name followed by parentheses.',
          'Do not forget the empty parentheses at the end.',
        ],
        solution: 'say_hi() calls the function. The parentheses are required even if there are no arguments.',
      },
      recommendedAfter: 'fn-defining-functions',
    },
    {
      id:    'fn-parameters',
      title: 'Parameters and Arguments',
      slug:  'parameters',
      tldr:  'Parameters let a function accept inputs. You pass actual values, called arguments, when you call it.',
      searchableTerms: ['parameter', 'argument', 'input', 'pass value', 'positional'],
      explanation: [
        'A parameter is a placeholder name inside the parentheses of a function definition. When you call the function and pass a value, that value gets stored in the parameter. So `def greet(name): print("Hi", name)` defines a parameter called `name`. Calling `greet("Sam")` passes `"Sam"` as an argument, and inside the function `name` holds `"Sam"`.',
        'You can have several parameters separated by commas: `def add(a, b):`. When calling, you must provide the same number of arguments in the same order: `add(3, 5)`. The terminology can be confusing — "parameter" is the name in the definition, "argument" is the actual value passed in. People often use the words interchangeably, but knowing the difference helps when reading documentation.',
      ],
      example: {
        code: `# greet takes a parameter called name.
def greet(name):
    print("Hi", name)

# Call with different arguments.
greet("Alex")
greet("Sam")`,
        output: 'Hi Alex\nHi Sam',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'In this function:\n\ndef show(message):\n    print(message)\n\nWhat is "message" called?',
        options: [
          'An argument',
          'A parameter',
          'A return value',
          'A variable type',
        ],
        correctOption: 1,
        hints: [
          'The name inside the function definition is the placeholder.',
          'An "argument" is the actual value passed in when calling.',
        ],
        solution: '"message" is a parameter — the placeholder name in the function definition.',
      },
      recommendedAfter: 'fn-calling-functions',
    },
    {
      id:    'fn-return-values',
      title: 'Return Values',
      slug:  'return-values',
      tldr:  'The return keyword sends a value back from a function so the caller can use it.',
      searchableTerms: ['return', 'output', 'result', 'value', 'send back'],
      explanation: [
        'A function can send a value back to whoever called it using the `return` keyword. When Python hits a `return`, it stops the function immediately and the value after `return` becomes the result of the function call. You can then store that result in a variable, like `total = add(3, 5)`, or use it directly in another expression.',
        'A function without a `return` statement still works, but it gives back the special value `None`. `None` is Python\'s way of saying "nothing." If you call `print(greet("Sam"))` on a function that does not return anything, you will see `None` after the greeting. Understanding when to return a value and when to just perform an action is one of the most important skills in programming.',
      ],
      example: {
        code: `# add returns the sum of its parameters.
def add(a, b):
    return a + b

# Store the returned value.
total = add(3, 5)
# total is now 8
print(total)`,
        output: '8',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What value does this function return when called as double(7)?\n\ndef double(x):\n    return x * 2',
        options: [
          '7',
          '14',
          'None',
          '"14"',
        ],
        correctOption: 1,
        hints: [
          'The function multiplies its parameter by 2.',
          '7 * 2 is the returned value.',
        ],
        solution: 'double(7) returns 14 because the function returns x * 2.',
      },
      recommendedAfter: 'fn-parameters',
    },
    {
      id:    'fn-scope',
      title: 'Scope',
      slug:  'scope',
      tldr:  'Variables defined inside a function only exist inside that function. This is called local scope.',
      searchableTerms: ['scope', 'local', 'global', 'visibility', 'namespace'],
      explanation: [
        'Scope is the rule that decides which variables can be seen from where. Variables defined inside a function have local scope, which means they only exist while the function is running. After the function ends, those local variables disappear. Variables defined outside any function have global scope and can be used anywhere in the file.',
        'Scope helps keep your code safe and organised. Two different functions can both have a local variable named `total` without affecting each other — each one lives in its own little bubble. If you need to use a value across functions, the cleanest way is to pass it in as a parameter and return a result. Avoid mixing global variables with function logic unless you really need to.',
      ],
      example: {
        code: `# x is local to the function — only exists inside.
def calculate():
    x = 10
    print(x)

calculate()
# Trying to print(x) here would cause a NameError.`,
        output: '10',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'In this code, where can the variable result be used?\n\ndef compute():\n    result = 42\n    return result',
        options: [
          'Anywhere in the program',
          'Only inside the compute function',
          'Only after compute is called',
          'Only in the line where it is defined',
        ],
        correctOption: 1,
        hints: [
          'Variables defined inside a function only exist there.',
          'This is called local scope.',
        ],
        solution: 'result is local to compute — it only exists while the function runs.',
      },
      recommendedAfter: 'fn-return-values',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 10 — Lists
// ---------------------------------------------------------------------------

const GROUP_LISTS: LessonGroup = {
  id: 'lists',
  title: 'Lists',
  subLessons: [
    {
      id:    'list-creating-lists',
      title: 'Creating Lists',
      slug:  'creating-lists',
      tldr:  'A list stores multiple values in a single variable, written between square brackets.',
      searchableTerms: ['list', 'array', 'square brackets', 'collection', 'sequence'],
      explanation: [
        'A list is an ordered collection of values. You create one by putting values between square brackets `[]`, separated by commas. For example, `colours = ["red", "green", "blue"]` stores three strings in a single variable called `colours`. Lists can hold any kind of value — strings, numbers, booleans, or even other lists. You can also mix types in one list, although usually you stick to one type.',
        'An empty list is just `[]` with nothing inside. You build it up later by adding items. Lists are perfect any time you have a group of things — a shopping list, a list of high scores, a list of friends. Lists are the most common collection in Python and one of the most useful features of the language.',
      ],
      example: {
        code: `# A list of strings.
fruits = ["apple", "banana", "cherry"]

# A list of integers.
scores = [85, 90, 72, 100]

# An empty list to fill later.
todo = []
print("Lists created")`,
        output: 'Lists created',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which line correctly creates a list of three numbers?',
        options: [
          'numbers = (1, 2, 3)',
          'numbers = {1, 2, 3}',
          'numbers = [1, 2, 3]',
          'numbers = "1, 2, 3"',
        ],
        correctOption: 2,
        hints: [
          'Lists use square brackets, not parentheses or curly braces.',
          'Parentheses make a tuple. Curly braces make a set.',
        ],
        solution: 'numbers = [1, 2, 3] creates a list using square brackets.',
      },
    },
    {
      id:    'list-accessing-items',
      title: 'Accessing Items',
      slug:  'accessing-items',
      tldr:  'Use square brackets and an index number to get an item out of a list. Indexes start at 0.',
      searchableTerms: ['index', 'access', 'subscript', 'position', 'negative index'],
      explanation: [
        'To get an item out of a list, write the list name followed by square brackets with the position number — called an index — inside. Python starts counting at 0, so the first item is at index 0, the second at index 1, and so on. If your list is `colours = ["red", "green", "blue"]`, then `colours[0]` is `"red"` and `colours[2]` is `"blue"`.',
        'You can also use negative indexes to count from the end. `colours[-1]` is the last item, `colours[-2]` is the second-to-last, and so on. This is handy when you do not know the exact length of the list. If you ask for an index that does not exist — like `colours[10]` on a list of 3 items — Python raises an `IndexError`. Always make sure your index is in range.',
      ],
      example: {
        code: `# Access items by index.
fruits = ["apple", "banana", "cherry"]
first = fruits[0]
# first is "apple"
last = fruits[-1]
# last is "cherry"
print(first)`,
        output: 'apple',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Given the list  pets = ["cat", "dog", "fish", "bird"], what does pets[2] return?',
        options: [
          '"cat"',
          '"dog"',
          '"fish"',
          '"bird"',
        ],
        correctOption: 2,
        hints: [
          'Counting starts at 0, so the indexes are 0, 1, 2, 3.',
          'Index 2 is the THIRD item in the list.',
        ],
        solution: 'pets[2] returns "fish" — the third item, because indexes start at 0.',
      },
      recommendedAfter: 'list-creating-lists',
    },
    {
      id:    'list-list-methods',
      title: 'List Methods',
      slug:  'list-methods',
      tldr:  'Lists have methods like .append(), .remove(), .pop(), and .sort() that modify the list in place.',
      searchableTerms: ['method', 'append', 'remove', 'pop', 'sort'],
      explanation: [
        'Lists come with many built-in methods. `.append(x)` adds `x` to the end of the list. `.remove(x)` deletes the first occurrence of `x`. `.pop()` removes and returns the last item, or `.pop(i)` removes the item at index `i`. `.sort()` rearranges the items into order. Each of these changes the list directly — they do not return a new list.',
        'Because list methods change the list in place, you do not assign the result. So `numbers.sort()` is correct, but `numbers = numbers.sort()` is a bug — `.sort()` returns `None`, so `numbers` would become `None`. This is different from string methods, which return new strings. Strings cannot be changed (immutable), but lists can (mutable). Knowing this distinction prevents many beginner errors.',
      ],
      example: {
        code: `# List methods modify the list in place.
fruits = ["apple", "banana"]
fruits.append("cherry")
# fruits is now ["apple", "banana", "cherry"]
fruits.remove("banana")
# fruits is now ["apple", "cherry"]
print("Modified")`,
        output: 'Modified',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which method adds a new item to the END of a list?',
        options: [
          '.add()',
          '.push()',
          '.append()',
          '.insert()',
        ],
        correctOption: 2,
        hints: [
          'The Python name is different from other languages like JavaScript.',
          'Think of the word that means "attach at the end".',
        ],
        solution: '.append(x) adds x to the end of the list.',
      },
      recommendedAfter: 'list-accessing-items',
    },
    {
      id:    'list-looping-lists',
      title: 'Looping Through Lists',
      slug:  'looping-lists',
      tldr:  'A for loop visits each item in a list one at a time, perfect for processing every entry.',
      searchableTerms: ['loop', 'iterate', 'for in', 'traverse', 'visit'],
      explanation: [
        'A `for` loop is the natural way to go through every item in a list. The pattern is `for item in my_list:` followed by an indented block. Each time the loop runs, the variable `item` holds the next value from the list. You do not need to track indexes yourself — Python handles that for you. The loop ends automatically when the list runs out of items.',
        'If you also need the index along with the value, use the built-in `enumerate` function: `for i, item in enumerate(my_list):`. Now `i` holds the index and `item` holds the value. But most of the time you only need the value, so the simpler `for item in my_list:` is the way to go. Looping over a list is one of the most-used patterns in all of Python.',
      ],
      example: {
        code: `# Loop through every fruit.
fruits = ["apple", "banana", "cherry"]
for fruit in fruits:
    print(fruit)
# Three lines printed — one per fruit.`,
        output: 'apple\nbanana\ncherry',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'How many times does this loop run?\n\ncolors = ["red", "green", "blue", "yellow"]\nfor c in colors:\n    print(c)',
        options: [
          '3',
          '4',
          '5',
          '1',
        ],
        correctOption: 1,
        hints: [
          'The loop runs once per item in the list.',
          'Count the items in colors.',
        ],
        solution: 'The loop runs 4 times — once for each of the 4 colors in the list.',
      },
      recommendedAfter: 'list-list-methods',
    },
    {
      id:    'list-list-slicing',
      title: 'List Slicing',
      slug:  'list-slicing',
      tldr:  'Like strings, lists support slicing with [start:stop] to grab a portion as a new list.',
      searchableTerms: ['slicing', 'sublist', 'colon', 'range', 'subset'],
      explanation: [
        'List slicing works the same way as string slicing. You use square brackets with two indexes separated by a colon: `my_list[start:stop]`. This returns a new list containing the items from index `start` up to but not including index `stop`. For example, `[10, 20, 30, 40, 50][1:4]` returns `[20, 30, 40]`. Leaving a side blank uses the start or end, so `numbers[2:]` returns everything from index 2 to the end.',
        'Slicing creates a new list — the original is untouched. This is useful when you want to work with part of a list without changing the whole thing. You can also use `my_list[:]` (no numbers) to make a complete copy of a list. This is handy when you want a backup before modifying the original.',
      ],
      example: {
        code: `# List slicing returns a new list.
numbers = [10, 20, 30, 40, 50]
middle = numbers[1:4]
# middle is [20, 30, 40]
first_two = numbers[:2]
# first_two is [10, 20]
print("Sliced")`,
        output: 'Sliced',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Given  numbers = [1, 2, 3, 4, 5], what does numbers[1:3] return?',
        options: [
          '[1, 2]',
          '[1, 2, 3]',
          '[2, 3]',
          '[2, 3, 4]',
        ],
        correctOption: 2,
        hints: [
          'Slicing starts at the first index and stops BEFORE the second index.',
          'Indexes 1 and 2 correspond to the second and third items.',
        ],
        solution: 'numbers[1:3] returns [2, 3] — items at indexes 1 and 2.',
      },
      recommendedAfter: 'list-looping-lists',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 11 — Dictionaries
// ---------------------------------------------------------------------------

const GROUP_DICTIONARIES: LessonGroup = {
  id: 'dictionaries',
  title: 'Dictionaries',
  subLessons: [
    {
      id:    'dict-creating-dicts',
      title: 'Creating Dictionaries',
      slug:  'creating-dicts',
      tldr:  'A dictionary stores key-value pairs in curly braces, like {"name": "Sam"}.',
      searchableTerms: ['dictionary', 'dict', 'key value', 'map', 'curly braces'],
      explanation: [
        'A dictionary stores pairs of values: a key and a value. The key is the label, and the value is the data. You write a dictionary using curly braces `{}` with the key, then a colon, then the value, separated by commas. For example, `student = {"name": "Sam", "age": 12}` makes a dictionary where the key `"name"` maps to `"Sam"` and the key `"age"` maps to `12`.',
        'Think of a dictionary like an actual paper dictionary — you look up a word (the key) to find its definition (the value). Or like a phone contact list — you look up a name (key) to find a number (value). Dictionaries are perfect for any kind of data with named fields. Keys are usually strings, but they can be numbers too. Each key must be unique within the dictionary.',
      ],
      example: {
        code: `# A dictionary with three pairs.
student = {
    "name": "Sam",
    "age": 12,
    "city": "London"
}

# An empty dictionary to fill later.
inventory = {}
print("Dicts created")`,
        output: 'Dicts created',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which line correctly creates a dictionary with one key-value pair?',
        options: [
          'd = ["name", "Sam"]',
          'd = ("name": "Sam")',
          'd = {"name": "Sam"}',
          'd = {"name" = "Sam"}',
        ],
        correctOption: 2,
        hints: [
          'Dictionaries use curly braces.',
          'Each pair uses a colon between key and value, not an equals sign.',
        ],
        solution: 'd = {"name": "Sam"} creates a dictionary with curly braces and a colon.',
      },
    },
    {
      id:    'dict-accessing-values',
      title: 'Accessing Values',
      slug:  'accessing-values',
      tldr:  'Use square brackets with the key to get the value, like student["name"].',
      searchableTerms: ['access', 'lookup', 'get', 'key', 'value'],
      explanation: [
        'To get a value out of a dictionary, write the dictionary name, then square brackets with the key inside. For example, if `student = {"name": "Sam", "age": 12}`, then `student["name"]` is `"Sam"` and `student["age"]` is `12`. This is similar to list access, but you use a key instead of a numeric index.',
        'If you ask for a key that does not exist — like `student["height"]` — Python raises a `KeyError` and your program stops. To avoid this, you can use the `.get()` method. `student.get("height")` returns `None` if the key is missing instead of crashing. You can also pass a default: `student.get("height", 0)` returns `0` if `"height"` is not there. This makes your code more robust.',
      ],
      example: {
        code: `# Look up a value by its key.
student = {"name": "Sam", "age": 12}
person_name = student["name"]
# person_name is "Sam"
person_age = student.get("age")
# person_age is 12
print("Looked up")`,
        output: 'Looked up',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Given  car = {"brand": "Tesla", "year": 2025}, what does car["brand"] return?',
        options: [
          '"Tesla"',
          '"year"',
          '2025',
          'None',
        ],
        correctOption: 0,
        hints: [
          'Use the key to look up the value.',
          '"brand" is the key. What value is paired with it?',
        ],
        solution: 'car["brand"] returns "Tesla" — the value paired with the key "brand".',
      },
      recommendedAfter: 'dict-creating-dicts',
    },
    {
      id:    'dict-adding-keys',
      title: 'Adding and Updating Keys',
      slug:  'adding-keys',
      tldr:  'Assign a value to a new or existing key with d[key] = value. New keys are added on the fly.',
      searchableTerms: ['add key', 'update', 'assign', 'modify', 'mutate'],
      explanation: [
        'You can add new key-value pairs to a dictionary any time. Just write the dictionary name with the new key in square brackets, and assign a value. For example, `student["grade"] = "B"` adds a `"grade"` key with value `"B"`. If the key already exists, the value is updated to the new one. This makes dictionaries flexible — they grow and change as your program runs.',
        'Updating works the same way. If `student["age"]` is already 12, writing `student["age"] = 13` replaces 12 with 13. There is no difference in syntax between adding and updating — Python figures out which one you mean by checking if the key already exists. To remove a key entirely, use the `del` keyword: `del student["age"]`.',
      ],
      example: {
        code: `# Start with two pairs.
student = {"name": "Sam", "age": 12}

# Add a new key.
student["grade"] = "B"

# Update an existing key.
student["age"] = 13
print("Updated")`,
        output: 'Updated',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'After this code, what value is stored at  d["score"] ?\n\nd = {"score": 10}\nd["score"] = 20\nd["score"] = 30',
        options: [
          '10',
          '20',
          '30',
          '60',
        ],
        correctOption: 2,
        hints: [
          'Each assignment replaces the previous value for that key.',
          'Only the last assigned value is kept.',
        ],
        solution: 'd["score"] is 30 — each new assignment overwrites the previous value.',
      },
      recommendedAfter: 'dict-accessing-values',
    },
    {
      id:    'dict-dict-methods',
      title: 'Dictionary Methods',
      slug:  'dict-methods',
      tldr:  'Dictionaries have .keys(), .values(), and .items() methods for getting parts of the data.',
      searchableTerms: ['keys', 'values', 'items', 'method', 'view'],
      explanation: [
        'Dictionaries have three handy methods for inspecting their contents. `.keys()` returns all the keys, `.values()` returns all the values, and `.items()` returns key-value pairs as tuples. These are most useful when you want to loop through a dictionary, because by default a `for` loop on a dictionary visits only the keys.',
        'A common pattern is `for key, value in my_dict.items():`. This unpacks each pair into two variables, which is much nicer than looking up the value separately. Another useful method is `.pop(key)`, which removes a key and returns its value. And `len(d)` (using the regular len function) tells you how many key-value pairs are in the dictionary.',
      ],
      example: {
        code: `# Methods for inspecting a dictionary.
student = {"name": "Sam", "age": 12}

# Get just the keys.
key_list = list(student.keys())
# key_list is ["name", "age"]

# Get just the values.
val_list = list(student.values())
print("Inspected")`,
        output: 'Inspected',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which dictionary method returns all the KEYS?',
        options: [
          '.values()',
          '.keys()',
          '.items()',
          '.pairs()',
        ],
        correctOption: 1,
        hints: [
          'The method name matches the part of the dictionary you want.',
          'For keys, use .keys(). For values, use .values().',
        ],
        solution: '.keys() returns all the keys of a dictionary.',
      },
      recommendedAfter: 'dict-adding-keys',
    },
    {
      id:    'dict-looping-dicts',
      title: 'Looping Through Dictionaries',
      slug:  'looping-dicts',
      tldr:  'Use for key in d: to loop over keys, or for k, v in d.items(): to loop over pairs.',
      searchableTerms: ['loop dict', 'iterate', 'items', 'for in', 'unpacking'],
      explanation: [
        'When you write a `for` loop directly on a dictionary, like `for k in student:`, Python gives you the keys one at a time. To get the value, you would need `student[k]`. A cleaner approach is `for k, v in student.items():`, which gives you both the key and the value as separate variables in each iteration.',
        'Looping is how you process every entry in a dictionary. You might be looking for a specific value, printing a summary, or computing a total. The `.items()` pattern is the most common — it is concise and reads almost like English: "for each key and value in the items of the dictionary." Master this pattern and dictionaries will feel as natural as lists.',
      ],
      example: {
        code: `# Loop with .items() for both key and value.
prices = {"apple": 1.0, "banana": 0.5}

for fruit, price in prices.items():
    # fruit takes each key, price takes each value.
    print(fruit)
print("done")`,
        output: 'apple\nbanana\ndone',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'In this loop, what does the variable k hold?\n\nscores = {"a": 1, "b": 2}\nfor k in scores:\n    print(k)',
        options: [
          'Each value in scores',
          'Each key in scores',
          'Each key-value pair',
          'The whole dictionary',
        ],
        correctOption: 1,
        hints: [
          'A plain for loop on a dictionary visits one part at a time.',
          'By default, it goes through the labels, not the data.',
        ],
        solution: 'k holds each KEY in turn — the default for-loop iterates over keys.',
      },
      recommendedAfter: 'dict-dict-methods',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 12 — Object-Oriented Programming (OOP)
// ---------------------------------------------------------------------------

const GROUP_OOP: LessonGroup = {
  id: 'oop',
  title: 'Object-Oriented Programming',
  subLessons: [
    {
      id:    'oop-what-is-a-class',
      title: 'What is a Class?',
      slug:  'what-is-a-class',
      tldr:  'A class is a blueprint for creating objects that share the same structure and behaviour.',
      searchableTerms: ['class', 'object', 'oop', 'blueprint', 'instance'],
      explanation: [
        'A class is a blueprint for creating things. Think of it like a cookie cutter — the class describes the shape, and each cookie made from it is an object. For example, a `Car` class might describe that all cars have a colour and a speed, and that they can drive and stop. Each individual car you create from the class is called an object or an instance.',
        'You define a class using the `class` keyword, followed by the name (by convention written in PascalCase, with each word capitalised) and a colon. The lines indented underneath describe what every instance of the class will have. This style of programming, where you organise code around classes and objects, is called Object-Oriented Programming or OOP. It is used everywhere in modern software.',
      ],
      example: {
        code: `# A class is a blueprint.
class Car:
    pass

# Each call to Car() creates a new instance.
my_car = Car()
your_car = Car()

# my_car and your_car are two separate objects.`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What is the difference between a class and an object?',
        options: [
          'They are the same thing',
          'A class is a blueprint; an object is an instance made from it',
          'A class is a function; an object is a variable',
          'An object is a blueprint; a class is made from it',
        ],
        correctOption: 1,
        hints: [
          'Think of the cookie cutter analogy.',
          'The class describes the shape; objects are the actual cookies.',
        ],
        solution: 'A class is the blueprint. An object is a specific instance created from it.',
      },
    },
    {
      id:    'oop-init-method',
      title: 'The __init__ Method',
      slug:  'init-method',
      tldr:  'The __init__ method runs automatically when a new object is created and sets up its data.',
      searchableTerms: ['init', 'constructor', 'dunder', 'self', 'initialization'],
      explanation: [
        'The `__init__` method is a special method that Python calls automatically every time you create a new object from a class. The name is short for "initialise" and the double underscores on both sides mark it as special (programmers call these "dunder methods"). The first parameter is always `self`, which refers to the new object being created. After that, you list any data you want to pass in.',
        'Inside `__init__`, you assign values to attributes of the object using `self.attribute_name = value`. For example, `self.colour = colour` stores the colour passed in as an attribute on the new car. After `__init__` finishes, the object is fully set up and ready to use. You will use `__init__` in almost every class you write.',
      ],
      example: {
        code: `# __init__ sets up each new object.
class Car:
    def __init__(self, colour, speed):
        self.colour = colour
        self.speed = speed

# Each Car() call passes arguments to __init__.
my_car = Car("red", 0)`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What is the purpose of the __init__ method?',
        options: [
          'To delete an object when no longer needed',
          'To set up data on a new object when it is created',
          'To compare two objects',
          'To convert an object to a string',
        ],
        correctOption: 1,
        hints: [
          '__init__ runs automatically each time you create a new object.',
          'It is short for "initialise" — to give something its starting values.',
        ],
        solution: '__init__ initialises a new object, setting up its starting data.',
      },
      recommendedAfter: 'oop-what-is-a-class',
    },
    {
      id:    'oop-instance-variables',
      title: 'Instance Variables',
      slug:  'instance-variables',
      tldr:  'Instance variables are attributes stored on each object using self.name in the class.',
      searchableTerms: ['instance variable', 'attribute', 'self', 'dot notation', 'property'],
      explanation: [
        'An instance variable is a piece of data attached to a specific object. You create instance variables inside the class methods by writing `self.name = value`. Each object made from the class gets its own copy of these variables, independent of every other object. So one car can be red and another can be blue, even though they come from the same `Car` class.',
        'You access instance variables from outside the class using dot notation: `my_car.colour`. This reads the colour attribute on the `my_car` object. You can also change them: `my_car.colour = "green"`. Instance variables are the data — what the object knows. Methods (coming next) are the actions — what the object can do.',
      ],
      example: {
        code: `# Each object has its own instance variables.
class Car:
    def __init__(self, colour):
        self.colour = colour

red_car = Car("red")
blue_car = Car("blue")

# red_car.colour is "red", blue_car.colour is "blue".`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'In this code, what is the value of car.colour?\n\nclass Car:\n    def __init__(self, colour):\n        self.colour = colour\n\ncar = Car("yellow")',
        options: [
          'Car',
          'self',
          'colour',
          '"yellow"',
        ],
        correctOption: 3,
        hints: [
          'The argument "yellow" is passed into __init__.',
          'Inside __init__, self.colour is set to that value.',
        ],
        solution: 'car.colour is "yellow" — the value passed in and stored as an instance variable.',
      },
      recommendedAfter: 'oop-init-method',
    },
    {
      id:    'oop-methods',
      title: 'Methods',
      slug:  'methods',
      tldr:  'A method is a function defined inside a class. It takes self as its first parameter.',
      searchableTerms: ['method', 'function', 'self', 'behaviour', 'action'],
      explanation: [
        'A method is a function that belongs to a class. You define one just like a regular function, except it lives inside the class and its first parameter is always `self`. The `self` refers to the specific object the method is being called on. So `def drive(self): self.speed = self.speed + 10` could be a method that speeds up a car by 10.',
        'You call a method using dot notation: `my_car.drive()`. Python automatically passes `my_car` as the `self` argument, so you do not list it yourself. Methods are how objects do things. Combined with instance variables (the data), methods (the behaviour) are the two halves of every class. Together they let you model real-world things in your code.',
      ],
      example: {
        code: `# A class with a method.
class Car:
    def __init__(self):
        self.speed = 0

    def drive(self):
        self.speed = self.speed + 10

# Call the method with dot notation.
my_car = Car()
my_car.drive()`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What is the first parameter of every method defined inside a class?',
        options: [
          'this',
          'self',
          'me',
          'instance',
        ],
        correctOption: 1,
        hints: [
          'Python uses a specific keyword for this — different from JavaScript and Java.',
          'It is a short English word starting with "s".',
        ],
        solution: 'self is the first parameter of every method. It refers to the object the method was called on.',
      },
      recommendedAfter: 'oop-instance-variables',
    },
    {
      id:    'oop-inheritance',
      title: 'Inheritance',
      slug:  'inheritance',
      tldr:  'A child class can inherit attributes and methods from a parent class, then add its own.',
      searchableTerms: ['inheritance', 'parent', 'child', 'subclass', 'extends'],
      explanation: [
        'Inheritance lets one class build on top of another. The new class (called the child or subclass) gets everything from the original (the parent or superclass) for free, and can add or change things. You write inheritance by putting the parent class name in parentheses after the child name: `class SportsCar(Car):`. Now `SportsCar` has all of `Car`\'s methods and instance variables.',
        'This is useful when you have several kinds of similar things. For example, a `Vehicle` class might handle the common behaviour, while `Car`, `Truck`, and `Motorcycle` are children that each add their own special features. Inheritance keeps your code organised and avoids repeating yourself. The child can also override a parent method by defining one with the same name.',
      ],
      example: {
        code: `# Parent class.
class Animal:
    def speak(self):
        print("Some sound")

# Child class inherits from Animal.
class Dog(Animal):
    def speak(self):
        # Override the parent method.
        print("Woof!")`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'In  class Dog(Animal):, what is Animal called?',
        options: [
          'A child class',
          'A subclass',
          'A parent (or superclass)',
          'An instance',
        ],
        correctOption: 2,
        hints: [
          'Dog is the new class being defined. Animal is what it inherits from.',
          'The class that gives, not the one that receives, is the parent.',
        ],
        solution: 'Animal is the parent class. Dog inherits from it, making Dog the child or subclass.',
      },
      recommendedAfter: 'oop-methods',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 13 — APIs and Requests
// ---------------------------------------------------------------------------

const GROUP_APIS: LessonGroup = {
  id: 'apis',
  title: 'APIs and Requests',
  subLessons: [
    {
      id:    'api-what-is-an-api',
      title: 'What is an API?',
      slug:  'what-is-an-api',
      tldr:  'An API is a way for two programs to talk to each other over the internet.',
      searchableTerms: ['api', 'application programming interface', 'web service', 'endpoint', 'rest'],
      explanation: [
        'API stands for Application Programming Interface. It is a way for two programs to talk to each other. When you check the weather on your phone, the app uses an API to ask a weather service for the latest data, and the service replies with numbers like temperature and humidity. The app then displays them nicely. Without APIs, every app would have to gather data itself.',
        'Most APIs on the web work like this: your program sends a request to a URL, and the server sends back a response with the data. The most common style is called REST, where you use standard HTTP methods like GET (to read) or POST (to send). Lots of websites offer free APIs — for weather, jokes, stock prices, dog photos, and almost anything else you can imagine.',
      ],
      example: {
        code: `# Conceptual example (uses the requests library).
# import requests
# response = requests.get("https://api.example.com/weather")
# data = response.json()
# Now data holds the weather information.`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What does API stand for?',
        options: [
          'Automatic Programming Internet',
          'Application Programming Interface',
          'Advanced Python Integration',
          'Asynchronous Page Indexer',
        ],
        correctOption: 1,
        hints: [
          'API has three words behind its three letters.',
          'It is about how programs (applications) interact with each other.',
        ],
        solution: 'API stands for Application Programming Interface.',
      },
    },
    {
      id:    'api-http-requests',
      title: 'HTTP Requests',
      slug:  'http-requests',
      tldr:  'HTTP requests are how programs ask servers for data. GET reads data, POST sends new data.',
      searchableTerms: ['http', 'get', 'post', 'request', 'method'],
      explanation: [
        'HTTP stands for HyperText Transfer Protocol. It is the language web browsers and servers use to talk to each other. When you visit a website, your browser sends an HTTP request to the server, and the server responds with the page. Your Python programs can do the same thing by sending HTTP requests through libraries like `requests` or `urllib`.',
        'HTTP has several methods. The two you use most often are `GET` (asking the server for data, like reading a page) and `POST` (sending new data to the server, like submitting a form). There are also `PUT`, `DELETE`, and `PATCH` for updating and deleting. Each request has a URL, optional headers (extra info), and sometimes a body (the data you are sending).',
      ],
      example: {
        code: `# Using the requests library (conceptual).
import requests

# GET: ask the server for data.
response = requests.get("https://api.example.com/data")

# POST: send new data to the server.
# response = requests.post(url, json={"name": "Sam"})`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which HTTP method is used to READ data from a server?',
        options: [
          'POST',
          'PUT',
          'GET',
          'DELETE',
        ],
        correctOption: 2,
        hints: [
          'POST sends new data. DELETE removes data.',
          'The method for "getting" something has a very obvious name.',
        ],
        solution: 'GET is the HTTP method used to read data from a server.',
      },
      recommendedAfter: 'api-what-is-an-api',
    },
    {
      id:    'api-json-data',
      title: 'JSON Data',
      slug:  'json-data',
      tldr:  'JSON is a text format for sending structured data over the internet. It looks like a Python dictionary.',
      searchableTerms: ['json', 'data format', 'serialization', 'dictionary', 'parse'],
      explanation: [
        'JSON stands for JavaScript Object Notation. It is the most common format for sending data between programs over the web. JSON uses curly braces for objects (like Python dictionaries) and square brackets for arrays (like Python lists). For example, `{"name": "Sam", "age": 12}` is valid JSON and almost identical to a Python dictionary.',
        'When an API sends you a response, it is usually in JSON. Python\'s built-in `json` module turns JSON text into Python data with `json.loads(text)`, and turns Python data into JSON text with `json.dumps(data)`. The `requests` library has a handy shortcut: `response.json()` does the conversion in one step. After that, you can use the data like any normal Python dictionary or list.',
      ],
      example: {
        code: `# JSON looks like Python dictionaries.
import json

# Text that came from an API.
text = '{"name": "Sam", "age": 12}'

# Convert JSON text to a Python dict.
data = json.loads(text)
# data["name"] is "Sam"`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which Python data type does a JSON object turn into?',
        options: [
          'list',
          'string',
          'dictionary',
          'tuple',
        ],
        correctOption: 2,
        hints: [
          'JSON objects use curly braces with key-value pairs.',
          'Which Python type uses curly braces and key-value pairs?',
        ],
        solution: 'A JSON object turns into a Python dictionary — both use curly braces and key-value pairs.',
      },
      recommendedAfter: 'api-http-requests',
    },
    {
      id:    'api-api-response',
      title: 'Working with an API Response',
      slug:  'api-response',
      tldr:  'Check the status code, parse the JSON, then access the data with normal Python.',
      searchableTerms: ['response', 'status code', '200', 'parse', 'access'],
      explanation: [
        'When you send an HTTP request, the server replies with a response object. Two important parts are the status code and the body. The status code is a number telling you whether things went well: `200` means OK, `404` means not found, `500` means the server had an error. Always check `response.status_code` before using the data.',
        'If the status is `200`, you can read the data with `response.json()`. This converts the JSON body into a Python dictionary or list. From there, access the fields like any other Python data: `data["name"]` for a key, `data[0]` for the first list item. Most API tutorials follow the pattern: request, check status, parse JSON, use data — that is the whole flow.',
      ],
      example: {
        code: `# Typical API call (conceptual).
import requests

response = requests.get("https://api.example.com/weather")

if response.status_code == 200:
    data = response.json()
    # Use data["temperature"], data["humidity"], etc.
else:
    print("Request failed")`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What HTTP status code means "OK, the request was successful"?',
        options: [
          '100',
          '200',
          '404',
          '500',
        ],
        correctOption: 1,
        hints: [
          '404 means "not found" and 500 means "server error".',
          'The success code is in the 200s.',
        ],
        solution: '200 means OK — the request was successful.',
      },
      recommendedAfter: 'api-json-data',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 14 — Files
// ---------------------------------------------------------------------------

const GROUP_FILES: LessonGroup = {
  id: 'files',
  title: 'Files',
  subLessons: [
    {
      id:    'file-reading-files',
      title: 'Reading Files',
      slug:  'reading-files',
      tldr:  'Use open() with mode "r" to read a file, and .read() or .readlines() to get the contents.',
      searchableTerms: ['read file', 'open', 'mode', 'with', 'context manager'],
      explanation: [
        'Python can read text files from your computer using the `open` function. You call `open(filename, "r")` where `"r"` means "read mode." That gives you a file object. You can then call `.read()` to get the whole content as one string, or `.readlines()` to get a list of lines. After you are done, you should close the file with `.close()`.',
        'The cleaner way is to use a `with` statement: `with open("data.txt", "r") as f: text = f.read()`. The `with` block automatically closes the file for you when it finishes, even if there is an error. Always prefer `with` — it is shorter and safer. Reading files is the foundation for working with logs, configuration, saved data, and lots more.',
      ],
      example: {
        code: `# Read a whole file using "with".
with open("notes.txt", "r") as f:
    text = f.read()

# text is now a string with the file's contents.
# The file is automatically closed after the with block.`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which mode string tells open() to READ a file?',
        options: [
          '"w"',
          '"r"',
          '"a"',
          '"x"',
        ],
        correctOption: 1,
        hints: [
          '"w" is for writing and "a" is for appending.',
          'The mode for reading matches the first letter of the word.',
        ],
        solution: '"r" is the read mode in the open function.',
      },
    },
    {
      id:    'file-writing-files',
      title: 'Writing Files',
      slug:  'writing-files',
      tldr:  'Open a file with mode "w" and use .write() to save text. Mode "w" overwrites the whole file.',
      searchableTerms: ['write file', 'save', 'overwrite', 'mode w', 'write method'],
      explanation: [
        'To write text to a file, use `open(filename, "w")`. The `"w"` mode means "write mode" and it does something important: if the file already exists, its contents are completely erased before you start writing. If it does not exist, Python creates it. Once you have the file object, use `.write(text)` to put a string into the file.',
        'Be careful with write mode — it really does erase everything. If you want to keep the existing content, use append mode `"a"` (which we will see next). Like with reading, the `with` statement is the safest way: `with open("output.txt", "w") as f: f.write("hello")`. The file is created or replaced, the text goes in, and the file is closed automatically.',
      ],
      example: {
        code: `# Write a string to a file.
with open("output.txt", "w") as f:
    f.write("Hello, file!\\n")
    f.write("Line 2\\n")

# If output.txt existed, it was overwritten.`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What happens to an existing file when you open it with mode "w"?',
        options: [
          'New content is added to the end',
          'The file is renamed automatically',
          'The existing content is erased',
          'Python raises an error',
        ],
        correctOption: 2,
        hints: [
          'Write mode does not preserve the old content.',
          'To keep old content, you would use append mode instead.',
        ],
        solution: 'Mode "w" erases the existing content before writing. Use "a" to keep it.',
      },
      recommendedAfter: 'file-reading-files',
    },
    {
      id:    'file-appending-files',
      title: 'Appending to Files',
      slug:  'appending-files',
      tldr:  'Mode "a" adds new text to the end of a file without erasing what is already there.',
      searchableTerms: ['append', 'mode a', 'add to file', 'log', 'end of file'],
      explanation: [
        'Append mode keeps the existing content of a file and adds new text at the end. You open the file with `open(filename, "a")`. If the file does not exist, Python creates it just like with write mode. The big difference is that any `.write()` calls add to whatever is already there, instead of replacing it.',
        'Append mode is perfect for logs — files where you keep a running record of events without losing the old ones. A game might append a line to `scores.txt` every time a player finishes a level. A website might append a line to `visits.txt` for every visitor. Each new entry is added to the bottom, building up a complete history over time.',
      ],
      example: {
        code: `# Append a line to an existing file.
with open("log.txt", "a") as f:
    f.write("New event\\n")

# Old content is preserved; "New event" is added at the end.`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Which mode adds new text to the END of an existing file without erasing it?',
        options: [
          '"r"',
          '"w"',
          '"a"',
          '"+"',
        ],
        correctOption: 2,
        hints: [
          '"r" reads. "w" overwrites.',
          'The append mode is named after the action.',
        ],
        solution: '"a" is the append mode. It adds new content at the end.',
      },
      recommendedAfter: 'file-writing-files',
    },
    {
      id:    'file-file-paths',
      title: 'File Paths',
      slug:  'file-paths',
      tldr:  'A file path tells Python where a file is. Relative paths are based on the current working directory.',
      searchableTerms: ['path', 'directory', 'relative', 'absolute', 'os'],
      explanation: [
        'A file path is the address of a file on your computer. There are two kinds. An absolute path starts from the very top — for example, `C:\\Users\\Sam\\notes.txt` on Windows or `/home/sam/notes.txt` on Mac and Linux. A relative path is shorter — like just `notes.txt` — and is interpreted relative to wherever your Python program is running from (the "current working directory").',
        'When you write `open("notes.txt", "r")`, Python looks in the current directory. If the file is in a subfolder, you include the folder name: `open("data/notes.txt", "r")`. The forward slash works on every operating system. For more complex path work, Python\'s `pathlib` module is the modern way — it handles paths in a clean, cross-platform manner.',
      ],
      example: {
        code: `# Relative path — file is in the same folder as the program.
with open("notes.txt", "r") as f:
    text = f.read()

# Relative path with a subfolder.
with open("data/scores.txt", "r") as f:
    scores = f.read()`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What is the difference between an absolute path and a relative path?',
        options: [
          'They are the same thing',
          'An absolute path is shorter; a relative path is longer',
          'An absolute path starts from the top; a relative path starts from the current folder',
          'A relative path only works for images',
        ],
        correctOption: 2,
        hints: [
          'An absolute path begins with the drive (Windows) or root /.',
          'A relative path is based on where your program is running.',
        ],
        solution: 'Absolute paths start from the root of the filesystem. Relative paths start from the current working directory.',
      },
      recommendedAfter: 'file-appending-files',
    },
  ],
}

// ---------------------------------------------------------------------------
// Group 15 — Error Handling
// ---------------------------------------------------------------------------

const GROUP_ERRORS: LessonGroup = {
  id: 'errors',
  title: 'Error Handling',
  subLessons: [
    {
      id:    'err-what-is-an-error',
      title: 'What is an Error?',
      slug:  'what-is-an-error',
      tldr:  'An error (also called an exception) happens when Python cannot continue running your code.',
      searchableTerms: ['error', 'exception', 'crash', 'traceback', 'bug'],
      explanation: [
        'An error in Python is also called an exception. It is what happens when Python runs into something it cannot do — like dividing by zero, asking for an item that does not exist, or trying to add a number to text. When an exception happens, Python stops your program and prints a traceback, which is a list of where the error came from.',
        'Common exceptions include `ZeroDivisionError` (you divided by zero), `TypeError` (wrong type, like adding a string and a number), `ValueError` (right type but bad value, like calling `int("hello")`), `IndexError` (list index out of range), and `KeyError` (dictionary key not found). Recognising these names is the first step to fixing them.',
      ],
      example: {
        code: `# Examples of errors.
# These lines would each raise an exception:

# result = 10 / 0           # ZeroDivisionError
# total = "hi" + 5          # TypeError
# number = int("hello")     # ValueError

print("This line works fine")`,
        output: 'This line works fine',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What error would Python raise for this line?\n\nresult = 10 / 0',
        options: [
          'TypeError',
          'ValueError',
          'ZeroDivisionError',
          'IndexError',
        ],
        correctOption: 2,
        hints: [
          'The mistake is dividing by zero, which is mathematically undefined.',
          'Python has a specific exception name for this exact problem.',
        ],
        solution: '10 / 0 raises ZeroDivisionError — Python cannot divide by zero.',
      },
    },
    {
      id:    'err-try-except',
      title: 'try and except',
      slug:  'try-except',
      tldr:  'Wrap risky code in a try block. If it fails, the except block handles the error gracefully.',
      searchableTerms: ['try', 'except', 'catch', 'handle', 'graceful'],
      explanation: [
        'The `try`/`except` block lets you handle errors instead of letting your program crash. You put the risky code inside the `try` block. If anything in there raises an exception, Python jumps to the `except` block instead of stopping. The structure is: `try:` followed by code, then `except:` followed by what to do if something goes wrong.',
        'A real example: asking the user for a number. If they type "hello" instead of a number, `int("hello")` raises a `ValueError`. Wrapping the conversion in a `try`/`except` lets you show a friendly message and ask again, rather than crashing. This pattern — try the risky thing, handle the failure — is everywhere in real-world Python code.',
      ],
      example: {
        code: `# Handle bad input with try/except.
try:
    age = int(input("Your age: "))
    print("Got it!")
except:
    # This runs if int() fails.
    print("That was not a number.")`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'What block contains the code that should run if an exception occurs?',
        options: [
          'try',
          'except',
          'else',
          'finally',
        ],
        correctOption: 1,
        hints: [
          'The try block contains the risky code itself.',
          'The block named after the act of catching the error contains the recovery code.',
        ],
        solution: 'The except block contains the code that handles the exception.',
      },
      recommendedAfter: 'err-what-is-an-error',
    },
    {
      id:    'err-multiple-exceptions',
      title: 'Handling Multiple Exceptions',
      slug:  'multiple-exceptions',
      tldr:  'You can catch specific exception types and have different except blocks for different errors.',
      searchableTerms: ['multiple exceptions', 'except type', 'specific', 'value error', 'type error'],
      explanation: [
        'Instead of using a bare `except:`, you can name the specific exception you want to catch: `except ValueError:`. This block only runs for that kind of error. You can chain several `except` clauses to handle different errors in different ways. For example, one block for `ValueError` (bad input) and another for `ZeroDivisionError` (math gone wrong).',
        'Catching specific exceptions is much better than catching every error at once. If you write a bare `except:`, you might accidentally hide a bug that has nothing to do with what you expected. By naming the exception, you make your code clearer and safer. You can also catch multiple types together with a tuple: `except (ValueError, TypeError):`.',
      ],
      example: {
        code: `# Different except blocks for different errors.
try:
    n = int(input("Number: "))
    result = 10 / n
except ValueError:
    print("That wasn't a number.")
except ZeroDivisionError:
    print("Can't divide by zero.")`,
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'Why is it better to use  except ValueError:  instead of plain  except: ?',
        options: [
          'It is shorter to type',
          'It only catches that specific error, leaving other bugs visible',
          'It catches more errors',
          'It runs faster',
        ],
        correctOption: 1,
        hints: [
          'A bare except catches everything, even bugs you did not expect.',
          'Naming the exception keeps your code safer and clearer.',
        ],
        solution: 'Specific excepts only catch the error you mean, so other bugs are not accidentally hidden.',
      },
      recommendedAfter: 'err-try-except',
    },
    {
      id:    'err-finally-block',
      title: 'The finally Block',
      slug:  'finally-block',
      tldr:  'The finally block runs no matter what — whether the try succeeded, failed, or raised an error.',
      searchableTerms: ['finally', 'cleanup', 'always runs', 'try finally', 'guaranteed'],
      explanation: [
        'The `finally` block is the last part of a `try`/`except` and it runs no matter what. Whether the `try` succeeded, whether an `except` caught an error, even whether you used `return` to leave the function — `finally` still runs before the function actually exits. This makes it perfect for cleanup tasks like closing files or releasing resources.',
        'For example, if you open a file and something goes wrong while reading it, you still want to close the file. Putting the close in `finally` guarantees it happens. Modern Python often uses `with` statements instead of `finally` for files, but `finally` is still useful in more complex situations. The full structure is `try / except / else / finally`, though you rarely need all four.',
      ],
      example: {
        code: `# finally runs no matter what.
try:
    print("Trying")
    # x = 1 / 0   # uncomment to see the error path
except ZeroDivisionError:
    print("Caught error")
finally:
    # This always prints, success or failure.
    print("Cleaning up")`,
        output: 'Trying\nCleaning up',
      },
      challenge: {
        type:   'multiple_choice',
        prompt: 'When does code inside a finally block run?',
        options: [
          'Only when the try block succeeds',
          'Only when an exception is raised',
          'Always, whether or not an exception occurred',
          'Only when no except matches',
        ],
        correctOption: 2,
        hints: [
          'The word "finally" is a clue — it happens at the very end.',
          'It does not care whether things went well or badly.',
        ],
        solution: 'finally runs in every case — success, caught exception, even an uncaught one.',
      },
      recommendedAfter: 'err-multiple-exceptions',
    },
  ],
}

// ---------------------------------------------------------------------------
// PYTHON_CURRICULUM — exported aggregate
// ---------------------------------------------------------------------------

export const PYTHON_CURRICULUM: LessonGroup[] = [
  GROUP_INTRODUCTION,
  GROUP_VARIABLES,
  GROUP_DATA_TYPES,
  GROUP_STRINGS,
  GROUP_NUMBERS,
  GROUP_INPUT_OUTPUT,
  GROUP_CONDITIONALS,
  GROUP_LOOPS,
  GROUP_FUNCTIONS,
  GROUP_LISTS,
  GROUP_DICTIONARIES,
  GROUP_OOP,
  GROUP_APIS,
  GROUP_FILES,
  GROUP_ERRORS,
]
