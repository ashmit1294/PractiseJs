# Aggregation in OOP: Has-A Relationship Explained

> **Source:** https://layrs.me/course/lld/02-class-relationships/aggregation
> **Level:** Beginner-Intermediate | **Read:** ~13 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Aggregation** | "Has-a" with independence — container holds parts that exist on their own |
| **Independent lifecycle** | Parts exist before, during, and after the container |
| **Shared parts** | Same part object can be in multiple containers simultaneously |
| **Weak ownership** | Container references parts, doesn't create or destroy them |
| **UML symbol** | Empty diamond (◇) on the container side |

> **Key Insight:** The "independent lifecycle" test separates aggregation from composition. Ask: "If I delete the container, do the parts die?" If NO → aggregation. A library closes; the books still exist and can go to another library.

---

## The Analogy — Spotify Playlist

- A song exists once in Spotify's catalog
- That same song can appear in millions of playlists
- Delete "My Road Trip Mix" — the song still exists in "Rock Classics"
- The playlist *aggregates* songs; it doesn't own or create them

---

## Why This Matters in Interviews

- Classic question: "Aggregation vs Composition — give an example"
- Must use the lifecycle argument, not just "one is stronger"
- Shows up in DB design: courses/students (aggregation), orders/items (composition)

> **Red flags:** Saying "aggregation is just weak composition," returning deep copies of parts, deep-copying instead of referencing shared objects

---

## Core Concept

### Independent Lifecycle Example

```python
class Student:
    def __init__(self, name, student_id):
        self.name = name
        self.student_id = student_id

    def get_info(self): return f"{self.name} ({self.student_id})"

class University:
    def __init__(self, name):
        self.name = name
        self.students: list = []   # aggregation: holds references

    def add_student(self, student):
        if student not in self.students:
            self.students.append(student)

    def remove_student(self, student):
        if student in self.students:
            self.students.remove(student)

# Students created BEFORE university — independent
alice = Student("Alice", "S001")
bob = Student("Bob", "S002")
charlie = Student("Charlie", "S003")   # never enrolled

uni = University("Tech University")
uni.add_student(alice)
uni.add_student(bob)

del uni   # university closes
# Students still alive!
print(alice.get_info())    # Alice (S001) — still exists
print(charlie.get_info())  # Charlie (S003) — never joined, still exists
```

### Shared Aggregation (One Object, Multiple Containers)

```python
class Song:
    def __init__(self, title, artist, duration):
        self.title = title
        self.artist = artist
        self.duration = duration

    def __str__(self):
        return f"{self.title} by {self.artist}"

class Playlist:
    def __init__(self, name):
        self.name = name
        self.songs: list = []

    def add_song(self, song: Song):
        self.songs.append(song)    # reference, not copy

    def total_duration(self):
        return sum(s.duration for s in self.songs)

# One song, multiple playlists — efficient
bohemian = Song("Bohemian Rhapsody", "Queen", 354)
hotel_ca = Song("Hotel California", "Eagles", 391)

rock_classics = Playlist("Rock Classics")
road_trip = Playlist("Road Trip Mix")

rock_classics.add_song(bohemian)
rock_classics.add_song(hotel_ca)
road_trip.add_song(hotel_ca)     # same object in both playlists!

del rock_classics    # gone, but songs still exist
print(hotel_ca)      # Hotel California by Eagles — still lives in road_trip
```

### Bidirectional Aggregation

```python
class Employee:
    def __init__(self, name, emp_id):
        self.name = name
        self.emp_id = emp_id
        self.departments: list = []   # can be in multiple

    def join_department(self, dept):
        if dept not in self.departments:
            self.departments.append(dept)

    def leave_department(self, dept):
        if dept in self.departments:
            self.departments.remove(dept)

class Department:
    def __init__(self, name):
        self.name = name
        self.employees: list = []

    def add_employee(self, emp):
        if emp not in self.employees:
            self.employees.append(emp)
            emp.join_department(self)   # maintain both sides

    def remove_employee(self, emp):
        if emp in self.employees:
            self.employees.remove(emp)
            emp.leave_department(self)  # maintain both sides

eng = Department("Engineering")
research = Department("Research")
bob = Employee("Bob", "E001")

eng.add_employee(bob)
research.add_employee(bob)   # Bob in two departments!

print([d.name for d in bob.departments])  # ['Engineering', 'Research']

eng.remove_employee(bob)
print([d.name for d in bob.departments])  # ['Research']
print(bob.name, "still exists:", bob.emp_id)  # Bob still exists: E001
```

---

## Aggregation vs Composition

| | Aggregation | Composition |
|---|---|---|
| UML | Empty diamond ◇ | Filled diamond ◆ |
| Lifecycle | Parts independent | Parts destroyed with container |
| Creation | Parts created externally | Parts created inside container |
| Sharing | Same part in multiple containers | Exclusive to one container |
| Example | Library → Books | Car → Engine |
| Code pattern | `self.parts = []` + `add_part(existing)` | `self.part = Part()` in `__init__` |

---

## Common Mistakes

### 1. Deep-copying instead of referencing (breaks aggregation)
```python
import copy

# WRONG — creates a duplicate, not aggregation
class Playlist:
    def add_song(self, song):
        self.songs.append(copy.deepcopy(song))  # changes don't propagate!

# RIGHT — store the reference
class Playlist:
    def add_song(self, song):
        self.songs.append(song)
```

### 2. Creating parts inside the container (becomes composition)
```python
# WRONG — Library creating books = composition, not aggregation
class Library:
    def __init__(self):
        self.books = [Book("Title1"), Book("Title2")]  # owned!

# RIGHT — receive existing books
class Library:
    def __init__(self):
        self.books = []
    def add_book(self, book):   # book was created elsewhere
        self.books.append(book)
```

### 3. Modifying shared parts without awareness
```python
class Team:
    def promote_player(self, player):
        player.level += 1   # This affects the player in ALL teams!
```
> Always document or handle this: shared aggregation means mutations are globally visible.

---

## Interview Q&A (Quick Fire)

**Q: Aggregation vs Composition in one sentence each?**
> "Aggregation = has-a with independent parts — a library has books that can exist elsewhere. Composition = owns-a with dependent parts — a car owns its engine, engine dies with the car."

**Q: How do you implement aggregation in code?**
> "Create parts externally, then pass them to the container. Store references, not copies. Provide `add`/`remove` methods that don't destroy the part — just remove the reference."

**Q: Can the same object be aggregated by multiple containers?**
> "Yes — that's shared aggregation. A song can be in multiple playlists, an employee in multiple departments. This is memory-efficient since the object exists once but is referenced from many places."

**Q: Design a Course-Student system.**
> "Students created independently. `Course` aggregates students via `enroll(student)` which appends a reference. `drop(student)` removes the reference but doesn't delete the student. A student can be in multiple courses — shared aggregation."

---

## Key Takeaways

- Aggregation = "has-a" where parts have **independent lifecycles** — they outlive the container
- The **lifecycle test**: if deleting the container kills the parts → composition; if parts survive → aggregation
- Parts can be **shared** across multiple containers (same object in multiple playlists)
- Always store **references**, not copies — deep-copying breaks aggregation semantics
- Maintain **bidirectional consistency**: `add`/`remove` methods should update both sides
