'use strict';

/* ==================================================
   الكتب
   copies = إجمالي النسخ الأصلي.
   المتاح يُحسب تلقائياً من سجلات القراءة والاستعارة.
================================================== */

const books = [
    {
        id: 1,
        title: 'Fundamentals of Nursing (Potter & Perry)',
        category: 'التمريض',
        copies: 1,
        image: 'img/books/fundamentals-nursing-potter.jpg'
    },
    {
        id: 2,
        title: 'Fundamentals of Nursing (Taylor)',
        category: 'التمريض',
        copies: 2,
        image: 'img/books/fundamentals-nursing-taylor.jpg'
    },
    {
        id: 3,
        title: 'Leadership Roles and Management Functions in Nursing',
        category: 'التمريض',
        copies: 3,
        image: 'img/books/leadership-nursing.jpg'
    },
    {
        id: 4,
        title: 'Pharmacology Made Incredibly Easy',
        category: 'علم الأدوية',
        copies: 4,
        image: 'img/books/pharmacology-made-easy.jpg'
    },
    {
        id: 5,
        title: 'Lippincott Illustrated Reviews: Pharmacology',
        category: 'علم الأدوية',
        copies: 5,
        image: 'img/books/lippincott-pharmacology.jpg'
    },
    {
        id: 6,
        title: "Gray's Anatomy for Students (5th Edition)",
        category: 'التشريح',
        copies: 6,
        image: 'img/books/grays-anatomy-5.jpg'
    },
    {
        id: 7,
        title: 'الجسم البشري',
        category: 'التشريح',
        copies: 7,
        image: 'img/books/human-body-ar.jpg'
    },
    {
        id: 8,
        title: "Gray's Anatomy for Students (4th Edition)",
        category: 'التشريح',
        copies: 8,
        image: 'img/books/grays-anatomy-4.jpg'
    },
    {
        id: 9,
        title: 'Guyton and Hall Textbook of Medical Physiology',
        category: 'وظائف الأعضاء',
        copies: 9,
        image: 'img/books/guyton-physiology.jpg'
    },
    {
        id: 10,
        title: 'فسيولوجيا الإنسان',
        category: 'وظائف الأعضاء',
        copies: 10,
        image: 'img/books/human-physiology-ar.jpg'
    },
    {
        id: 11,
        title: "Langman's Medical Embryology",
        category: 'علم الأجنة',
        copies: 11,
        image: 'img/books/langman-embryology.jpg'
    },
    {
        id: 12,
        title: "Jawetz, Melnick & Adelberg's Medical Microbiology",
        category: 'الأحياء الدقيقة',
        copies: 12,
        image: 'img/books/medical-microbiology.jpg'
    },
    {
        id: 13,
        title: 'Robbins & Cotran Pathologic Basis of Disease',
        category: 'علم الأمراض',
        copies: 13,
        image: 'img/books/robbins-pathology.jpg'
    },
    {
        id: 14,
        title: "Harrison's Principles of Internal Medicine",
        category: 'الطب الباطني',
        copies: 14,
        image: 'img/books/harrison-internal-medicine.jpg'
    },
    {
        id: 15,
        title: 'Psychiatric-Mental Health Nursing',
        category: 'الصحة النفسية',
        copies: 15,
        image: 'img/books/psychiatric-nursing.jpg'
    },
    {
        id: 16,
        title: 'الإسعافات الأولية',
        category: 'الإسعافات الأولية',
        copies: 16,
        image: 'img/books/first-aid-ar.jpg'
    }
];

/* ===== أدوات مشتركة ===== */

const STORAGE_KEY = 'library_records';

const $ = id => document.getElementById(id);

function element(tag, className = '', text = '') {
    const node = document.createElement(tag);

    node.className = className;
    node.textContent = text;

    return node;
}

function normalize(value) {
    return String(value)
        .toLowerCase()
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .trim();
}

function formatDate(value = new Date()) {
    return new Date(value).toLocaleString('ar-SA', {
        timeZone: 'Asia/Riyadh',
        calendar: 'gregory',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/* ===== قراءة السجلات القديمة والجديدة ===== */

function readRecords() {
    let rows;

    try {
        rows = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || '[]'
        );
    } catch {
        throw new Error(
            'تعذر قراءة السجلات. لا تمسحي بيانات المتصفح؛ ' +
            'قد يكون التخزين محظوراً أو البيانات غير سليمة.'
        );
    }

    const fields = [
        'id',
        'name',
        'idNumber',
        'needs',
        'date'
    ];

    const invalid = !Array.isArray(rows) || rows.some(row => {
        if (!row || fields.some(key => typeof row[key] !== 'string')) {
            return true;
        }

        if (row.inventoryVersion === 2) {
            return (
                !['reading', 'borrowing', 'other'].includes(row.purpose) ||
                !(
                    row.completedAt === null ||
                    typeof row.completedAt === 'string'
                ) ||
                (
                    row.purpose !== 'other' &&
                    !Number.isInteger(row.bookId)
                )
            );
        }

        return false;
    });

    if (invalid) {
        throw new Error('بيانات السجلات غير سليمة. لم يتم تعديلها.');
    }

    return rows;
}

/* ===== حساب النسخ المستخدمة والمتاحة ===== */

function isActive(row) {
    return (
        row.inventoryVersion === 2 &&
        row.completedAt === null &&
        ['reading', 'borrowing'].includes(row.purpose)
    );
}

function inventory(book, rows) {
    const active = rows.filter(row => {
        return isActive(row) && row.bookId === book.id;
    });

    const reading = active.filter(row => {
        return row.purpose === 'reading';
    }).length;

    const borrowed = active.filter(row => {
        return row.purpose === 'borrowing';
    }).length;

    return {
        reading,
        borrowed,
        available: Math.max(0, book.copies - active.length)
    };
}

/* ===== إضافة سجل وإرجاع نسخة ===== */

function addRecord(rows, record) {
    if (rows.some(row => row.id === record.id)) {
        throw new Error('هذا التسجيل محفوظ مسبقاً.');
    }

    if (record.purpose !== 'other') {
        const book = books.find(book => book.id === record.bookId);

        if (!book || inventory(book, rows).available < 1) {
            throw new Error(
                'لا توجد نسخة متاحة من الكتاب المحدد. اختاري كتاباً آخر.'
            );
        }
    }

    rows.unshift(record);
}

function finishRecord(rows, id) {
    const row = rows.find(row => row.id === id);

    if (!row) {
        throw new Error('السجل غير موجود.');
    }

    // الضغط المتكرر على الإرجاع لا يزيد العدد أكثر من مرة.
    if (isActive(row)) {
        row.completedAt = new Date().toISOString();
    }
}

/* ===== حفظ العمليات بالتتابع بين التبويبات ===== */

async function changeRecords(change) {
    if (!navigator.locks) {
        throw new Error(
            'افتحي الموقع عبر Live Server في Chrome أو Edge ' +
            'لتفعيل الحفظ الآمن بين التبويبات.'
        );
    }

    await navigator.locks.request('ghad-library-records', () => {
        const rows = readRecords();

        change(rows);

        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(rows)
            );
        } catch {
            throw new Error(
                'تعذر الحفظ؛ قد يكون تخزين المتصفح ممتلئاً. ' +
                'لم تتغير أعداد الكتب.'
            );
        }
    });
}

function showError(error) {
    alert(error.message || 'تعذر تنفيذ العملية.');
}

function watchRecords(refresh) {
    window.addEventListener('storage', event => {
        if (event.key === STORAGE_KEY || event.key === null) {
            refresh();
        }
    });

    window.addEventListener('pageshow', refresh);
    window.addEventListener('focus', refresh);
}

/* ==================================================
   معرض الكتب والإحصائيات
================================================== */

function initializeBooksPage() {
    const stats = document.querySelector('.book-stats');

    // إضافة العدّادين الجديدين تلقائياً.
    const newStats = [
        ['reading-count', 'قيد القراءة داخل المكتبة'],
        ['borrowed-count', 'الكتب المستعارة']
    ];

    newStats.forEach(([id, title]) => {
        if ($(id)) {
            return;
        }

        const card = element('div', 'stat-card');
        const value = element('strong', '', '0');

        value.id = id;

        card.append(
            element('span', '', title),
            value
        );

        stats.append(card);
    });

    const categories = [
        ...new Set(books.map(book => book.category))
    ];

    $('book-category').replaceChildren(
        new Option('جميع التصنيفات', '')
    );

    categories.forEach(category => {
        $('book-category').add(
            new Option(category, category)
        );
    });

    const note = document.querySelector(
        '.gallery-heading + p.muted'
    );

    if (note) {
        note.textContent =
            'المتاح = إجمالي النسخ − النسخ قيد القراءة − النسخ المستعارة.';
    }

    function render() {
        try {
            const rows = readRecords();

            $('titles-count').textContent = books.length;

            $('copies-count').textContent = books.reduce(
                (sum, book) => sum + book.copies,
                0
            );

            $('categories-count').textContent = categories.length;

            $('reading-count').textContent = rows.filter(row => {
                return isActive(row) && row.purpose === 'reading';
            }).length;

            $('borrowed-count').textContent = rows.filter(row => {
                return isActive(row) && row.purpose === 'borrowing';
            }).length;

            const query = normalize($('book-search').value);
            const category = $('book-category').value;

            const filtered = books.filter(book => {
                return (
                    normalize(book.title).includes(query) &&
                    (!category || book.category === category)
                );
            });

            $('books-grid').replaceChildren();

            filtered.forEach(book => {
                const state = inventory(book, rows);

                const card = element('article', 'book-card');
                const stage = element('div', 'book-stage');
                const image = element('img', 'book-photo');

                image.src = book.image;
                image.alt = 'غلاف ' + book.title;
                image.loading = 'lazy';

                image.addEventListener('error', () => {
                    stage.replaceChildren(
                        element('span', 'muted', book.title)
                    );
                }, { once: true });

                stage.append(image);

                card.append(
                    stage,
                    element('span', 'book-category', book.category),
                    element('h3', '', book.title)
                );

                const counts = [
                    ['المتاح الآن', state.available],
                    ['إجمالي النسخ', book.copies],
                    ['قيد القراءة', state.reading],
                    ['مستعار', state.borrowed]
                ];

                counts.forEach(([label, count]) => {
                    const line = element('div', 'book-count');

                    line.append(
                        element('span', '', label),
                        element('strong', '', count)
                    );

                    card.append(line);
                });

                $('books-grid').append(card);
            });

            $('books-result-count').textContent =
                filtered.length + ' عنوان';

            $('no-books').hidden = filtered.length !== 0;

        } catch (error) {
            $('books-grid').replaceChildren(
                element('p', 'muted', error.message)
            );

            $('reading-count').textContent = '—';
            $('borrowed-count').textContent = '—';
            $('no-books').hidden = true;
        }
    }

    $('book-search').addEventListener('input', render);
    $('book-category').addEventListener('change', render);

    watchRecords(render);
    render();
}

/* ==================================================
   التوقيع
================================================== */

function initializeSignature() {
    const canvas = $('sig-canvas');

    if (!canvas) {
        return {
            valid: () => true,
            data: () => '',
            clear() {},
            resize() {}
        };
    }

    const ctx = canvas.getContext('2d');

    let strokes = [];
    let current = null;
    let pointer = null;

    function redraw() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        ctx.clearRect(0, 0, width, height);

        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#3e2723';
        ctx.fillStyle = '#3e2723';

        strokes.forEach(stroke => {
            ctx.beginPath();

            ctx.arc(
                stroke[0].x * width,
                stroke[0].y * height,
                1.5,
                0,
                Math.PI * 2
            );

            ctx.fill();
            ctx.beginPath();

            ctx.moveTo(
                stroke[0].x * width,
                stroke[0].y * height
            );

            stroke.slice(1).forEach(point => {
                ctx.lineTo(
                    point.x * width,
                    point.y * height
                );
            });

            ctx.stroke();
        });

        $('sig-placeholder').hidden = strokes.length > 0;
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();

        if (!rect.width || !rect.height) {
            return;
        }

        const ratio = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

        redraw();
    }

    function position(event) {
        const rect = canvas.getBoundingClientRect();

        return {
            x: Math.max(
                0,
                Math.min(1, (event.clientX - rect.left) / rect.width)
            ),

            y: Math.max(
                0,
                Math.min(1, (event.clientY - rect.top) / rect.height)
            )
        };
    }

    canvas.addEventListener('pointerdown', event => {
        if (pointer !== null || event.button !== 0) {
            return;
        }

        event.preventDefault();

        pointer = event.pointerId;
        canvas.setPointerCapture(pointer);

        current = [position(event)];
        strokes.push(current);

        redraw();
    });

    canvas.addEventListener('pointermove', event => {
        if (event.pointerId !== pointer || !current) {
            return;
        }

        event.preventDefault();

        current.push(position(event));
        redraw();
    });

    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
        canvas.addEventListener(type, event => {
            if (event.pointerId === pointer) {
                pointer = null;
                current = null;
            }
        });
    });

    function clear() {
        strokes = [];
        current = null;
        pointer = null;

        redraw();
    }

    $('clear-signature').addEventListener('click', clear);
    window.addEventListener('resize', resize);

    if ('ResizeObserver' in window) {
        new ResizeObserver(resize).observe(canvas);
    }

    requestAnimationFrame(resize);

    return {
        valid: () => strokes.length > 0,
        data: () => canvas.toDataURL('image/png'),
        clear,
        resize
    };
}

/* ==================================================
   تسجيل الزيارات ولوحة المسؤولة
================================================== */

function initializeVisitsPage() {
    const form = $('student-form');
    const purpose = $('visit-purpose');
    const details = $('need-details');
    const signature = initializeSignature();

    let busy = false;

    /* إضافة قائمة الكتب للنموذج الحالي */
    const bookBox = element('div', 'field');
    bookBox.id = 'visit-book-box';

    const label = element('label', '', 'اختر الكتاب:');
    label.htmlFor = 'visit-book';

    const select = element('select');
    select.id = 'visit-book';

    bookBox.append(label, select);
    purpose.closest('.field').after(bookBox);

    /* تحديث حقول الغرض وأعداد القائمة */
    function refreshOptions() {
        const previous = select.value;

        const needsBook = [
            'reading',
            'borrowing'
        ].includes(purpose.value);

        bookBox.hidden = !needsBook;
        select.required = needsBook;
        select.disabled = !needsBook;

        $('need-details-box').hidden = purpose.value !== 'other';

        details.disabled = purpose.value !== 'other';
        details.required = purpose.value === 'other';

        $('need-details-label').textContent = 'اكتب احتياجك:';
        details.placeholder = 'وضّح الخدمة أو الاحتياج الذي تريده...';
        details.setCustomValidity('');

        try {
            const rows = readRecords();

            select.replaceChildren(
                new Option('اختر الكتاب من القائمة', '')
            );

            books.forEach(book => {
                const available = inventory(book, rows).available;

                const option = new Option(
                    book.title + ' — المتاح: ' + available,
                    String(book.id)
                );

                option.disabled = available === 0;

                select.add(option);
            });

            const old = [...select.options].find(option => {
                return option.value === previous && !option.disabled;
            });

            select.value = old ? previous : '';

        } catch (error) {
            select.replaceChildren(
                new Option('تعذر تحميل الأعداد', '')
            );

            select.disabled = true;
        }
    }

    purpose.addEventListener('change', refreshOptions);

    /* التبديل بين الطالب والمسؤولة */
    function switchTab(isStudent) {
        $('view-student').hidden = !isStudent;
        $('view-librarian').hidden = isStudent;

        $('tab-student').classList.toggle('active', isStudent);
        $('tab-librarian').classList.toggle('active', !isStudent);

        $('tab-student').setAttribute(
            'aria-pressed',
            String(isStudent)
        );

        $('tab-librarian').setAttribute(
            'aria-pressed',
            String(!isStudent)
        );

        if (isStudent) {
            refreshOptions();
            requestAnimationFrame(signature.resize);
        } else {
            renderRecords();
        }
    }

    $('tab-student').addEventListener('click', () => {
        switchTab(true);
    });

    $('tab-librarian').addEventListener('click', () => {
        switchTab(false);
    });

    window.addEventListener('hashchange', () => {
        switchTab(location.hash !== '#librarian');
    });

    /* حفظ التسجيل وخصم النسخة */
    form.addEventListener('submit', async event => {
        event.preventDefault();

        if (busy || !form.reportValidity()) {
            return;
        }

        const name = $('student-name').value.trim();
        const idNumber = $('student-id').value.trim();
        const kind = purpose.value;
        const other = details.value.trim();

        const book = books.find(book => {
            return book.id === Number(select.value);
        });

        if (
            !name ||
            !idNumber ||
            !['reading', 'borrowing', 'other'].includes(kind)
        ) {
            alert('أكملي الاسم والرقم والغرض من الزيارة.');
            return;
        }

        if (kind === 'other' ? !other : !book) {
            alert('أكملي اختيار الكتاب أو تفاصيل الاحتياج.');
            return;
        }

        if (!signature.valid()) {
            alert('يرجى التوقيع قبل حفظ التسجيل.');
            return;
        }

        busy = true;
        $('submit-button').disabled = true;

        try {
            const now = new Date();

            const needs = kind === 'other'
                ? 'شيء آخر — ' + other
                : (
                    kind === 'reading'
                        ? 'قراءة داخل المكتبة — '
                        : 'استعارة — '
                ) + book.title;

            const record = {
                id: crypto.randomUUID(),
                name,
                idNumber,
                needs,

                date: formatDate(now),
                createdAt: now.toISOString(),
                signature: signature.data(),

                inventoryVersion: 2,
                purpose: kind,
                bookId: kind === 'other' ? null : book.id,
                bookTitle: kind === 'other' ? '' : book.title,
                completedAt: null
            };

            await changeRecords(rows => {
                addRecord(rows, record);
            });

            refreshOptions();

            $('success-modal').hidden = false;
            $('close-success').focus();

        } catch (error) {
            busy = false;
            $('submit-button').disabled = false;

            refreshOptions();
            showError(error);
        }
    });

    /* إغلاق رسالة النجاح */
    function closeModal() {
        $('success-modal').hidden = true;

        form.reset();
        signature.clear();

        busy = false;
        $('submit-button').disabled = false;

        refreshOptions();
        $('student-name').focus();
    }

    $('close-success').addEventListener('click', closeModal);

    $('success-modal').addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeModal();
        }

        if (event.key === 'Tab') {
            event.preventDefault();
            $('close-success').focus();
        }
    });

    /* تنفيذ عمليات المسؤولة */
    async function runAction(button, action) {
        button.disabled = true;

        try {
            await changeRecords(action);

        } catch (error) {
            showError(error);

        } finally {
            button.disabled = false;
            refreshOptions();
            renderRecords();
        }
    }

    /* عرض السجلات */
    function renderRecords() {
        const container = $('records-container');

        try {
            const rows = readRecords();
            const query = normalize($('search-input').value);

            const filtered = rows.filter(row => {
                return [
                    row.name,
                    row.idNumber,
                    row.needs
                ].some(value => normalize(value).includes(query));
            });

            container.replaceChildren();

            $('record-count').textContent =
                filtered.length + ' سجلات';

            $('no-records').hidden = filtered.length !== 0;

            $('empty-title').textContent = rows.length
                ? 'لا توجد نتائج تطابق البحث'
                : 'لا توجد سجلات حتى الآن';

            filtered.forEach(row => {
                const card = element('article', 'record-card');

                card.append(
                    element('h3', '', row.name),

                    element(
                        'p',
                        'record-number',
                        'الرقم: ' + row.idNumber
                    ),

                    element('p', 'record-needs', row.needs),

                    element(
                        'p',
                        'record-date',
                        'التسجيل: ' + row.date
                    )
                );

                /* عرض التوقيع */
                if (
                    typeof row.signature === 'string' &&
                    /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(
                        row.signature
                    )
                ) {
                    const image = element('img', 'signature-image');

                    image.src = row.signature;
                    image.alt = 'توقيع الطالب';

                    card.append(image);
                }

                /* الحالة وزر الإرجاع */
                if (isActive(row)) {
                    card.append(
                        element(
                            'p',
                            'muted',
                            row.purpose === 'reading'
                                ? 'الحالة: قيد القراءة'
                                : 'الحالة: مستعار'
                        )
                    );

                    const finish = element(
                        'button',
                        'primary-button',
                        row.purpose === 'reading'
                            ? 'إنهاء القراءة وإرجاع النسخة'
                            : 'تأكيد إرجاع الكتاب'
                    );

                    finish.type = 'button';

                    finish.addEventListener('click', () => {
                        if (!confirm('هل استلمتِ نسخة الكتاب فعلياً؟')) {
                            return;
                        }

                        runAction(finish, rows => {
                            finishRecord(rows, row.id);
                        });
                    });

                    card.append(finish);

                } else if (
                    row.inventoryVersion === 2 &&
                    row.purpose !== 'other'
                ) {
                    card.append(
                        element(
                            'p',
                            'muted',
                            'أُعيدت النسخة: ' + formatDate(row.completedAt)
                        )
                    );

                } else if (row.inventoryVersion !== 2) {
                    card.append(
                        element(
                            'p',
                            'muted',
                            'سجل سابق — غير مرتبط بمخزون الكتب.'
                        )
                    );
                }

                /* منع حذف سجل كتاب لم يُرجع */
                const remove = element(
                    'button',
                    'danger-button',
                    'حذف السجل'
                );

                remove.type = 'button';
                remove.disabled = isActive(row);

                remove.title = isActive(row)
                    ? 'أكدي إرجاع الكتاب قبل حذف السجل'
                    : 'حذف السجل';

                remove.addEventListener('click', () => {
                    if (!confirm('حذف هذا السجل نهائياً؟')) {
                        return;
                    }

                    runAction(remove, rows => {
                        const index = rows.findIndex(item => {
                            return item.id === row.id;
                        });

                        if (index < 0) {
                            return;
                        }

                        if (isActive(rows[index])) {
                            throw new Error('أعيدي الكتاب أولاً.');
                        }

                        rows.splice(index, 1);
                    });
                });

                card.append(remove);
                container.append(card);
            });

        } catch (error) {
            container.replaceChildren(
                element('p', 'muted', error.message)
            );

            $('record-count').textContent = 'تعذر القراءة';
            $('no-records').hidden = true;
        }
    }

    $('search-input').addEventListener('input', renderRecords);

    /* حذف الجميع بعد إرجاع النسخ */
    $('clear-records').addEventListener('click', () => {
        const approved = confirm(
            'حذف جميع السجلات؟ لا يمكن الحذف إذا توجد كتب لم تُرجع.'
        );

        if (!approved) {
            return;
        }

        runAction($('clear-records'), rows => {
            if (rows.some(isActive)) {
                throw new Error(
                    'توجد نسخ قيد القراءة أو الاستعارة. ' +
                    'سجلي إرجاعها أولاً.'
                );
            }

            rows.splice(0, rows.length);
        });
    });

    /* تحديث القائمة والسجلات عند تغيير البيانات */
    watchRecords(() => {
        refreshOptions();

        if (!$('view-librarian').hidden) {
            renderRecords();
        }
    });

    switchTab(location.hash !== '#librarian');
}

/* ==================================================
   تشغيل الصفحات والشعار
================================================== */

document.querySelectorAll('.college-logo').forEach(logo => {
    function fallback() {
        logo.hidden = true;

        const replacement = logo.parentElement.querySelector(
            '.logo-fallback'
        );

        if (replacement) {
            replacement.textContent = 'مكتبة الغد';
            replacement.hidden = false;
        }
    }

    logo.addEventListener('error', fallback);

    if (logo.complete && !logo.naturalWidth) {
        fallback();
    }
});

if ($('student-form')) {
    initializeVisitsPage();
}

if ($('books-grid')) {
    initializeBooksPage();
}