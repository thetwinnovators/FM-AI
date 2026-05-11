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
]
