/**
 * קובץ: src/components/help/HelpCenter.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור עזרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: topicIsVisible, topicMatchesRoute, normalizeSearchValue, topicMatchesSearch, HelpCenter.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Search,
  X,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  createPortal,
} from 'react-dom';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../../auth/AuthContext';

import {
  helpGroupLabels,
  helpTopics,
} from '../../help/helpRegistry';

import type {
  HelpTopic,
} from '../../help/helpTypes';

import '../../styles/helpCenter.css';

/**
 * פעולה topicIsVisible: הנתון topicIsVisible בהקשר הפעולה.
 * @param topic — הנתון topic בהקשר הפעולה.
 * @param hasPermission — הרשאות.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function topicIsVisible(
  topic:
    HelpTopic,

  hasPermission:
    ReturnType<
      typeof useAuth
    >['hasPermission'],
): boolean {
  // anyPermissions — הרשאות.
  const anyPermissions =
    topic.requiredAnyPermissions ??
    [];

  // allPermissions — הרשאות.
  const allPermissions =
    topic.requiredAllPermissions ??
    [];

  const matchesAny =
    anyPermissions.length ===
      0 ||
    anyPermissions.some(
      (
        permission,
      ) =>
        hasPermission(
          permission,
        ),
    );

  const matchesAll =
    allPermissions.every(
      (
        permission,
      ) =>
        hasPermission(
          permission,
        ),
    );

  return (
    matchesAny &&
    matchesAll
  );
}

/**
 * פעולה topicMatchesRoute: הנתון topicMatchesRoute בהקשר הפעולה.
 * @param topic — הנתון topic בהקשר הפעולה.
 * @param pathname — הנתון pathname בהקשר הפעולה.
 * @param search — הנתון search בהקשר הפעולה.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function topicMatchesRoute(
  topic:
    HelpTopic,

  pathname:
    string,

  search:
    string,
): boolean {
  // pathMatches — נתיב.
  const pathMatches =
    topic.routePrefixes
      .includes(
        '/',
      ) &&
    pathname ===
      '/'
      ? true
      : topic.routePrefixes
          .some(
            (
              prefix,
            ) =>
              prefix !== '/' &&
              pathname.startsWith(
                prefix,
              ),
          );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !pathMatches.
  if (!pathMatches) {
    return false;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !topic.contextualQuery.
  if (
    !topic.contextualQuery
  ) {
    return true;
  }

  const params =
    new URLSearchParams(
      search,
    );

  return Object.entries(
    topic.contextualQuery,
  ).every(
    ([
      key,
      expectedValue,
    ]) =>
      params.get(
        key,
      ) ===
        expectedValue,
  );
}

/**
 * פעולה normalizeSearchValue: נרמול ערך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeSearchValue(
  value:
    string,
): string {
  return value
    .trim()
    .toLocaleLowerCase(
      'he-IL',
    );
}

/**
 * פעולה topicMatchesSearch: הנתון topicMatchesSearch בהקשר הפעולה.
 * @param topic — הנתון topic בהקשר הפעולה.
 * @param searchValue — ערך.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function topicMatchesSearch(
  topic:
    HelpTopic,

  searchValue:
    string,
): boolean {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !searchValue.
  if (!searchValue) {
    return true;
  }

  const searchableText = [
    topic.title,
    topic.summary,
    ...topic.steps,
    ...(topic.notes ?? []),
    ...(topic.keywords ?? []),
  ]
    .join(' ')
    .toLocaleLowerCase(
      'he-IL',
    );

  return searchableText
    .includes(
      searchValue,
    );
}

/**
 * פעולה HelpCenter: עזרה.
 */
function HelpCenter() {
  const {
    hasPermission,
  } =
    useAuth();

  const location =
    useLocation();

  const navigate =
    useNavigate();

  // מצב מקומי: isOpen — האם המצב פתוח; setIsOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isOpen,
    setIsOpen,
  ] =
    useState(
      false,
    );

  // מצב מקומי: searchQuery — הנתון searchQuery בהקשר הפעולה; setSearchQuery מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState('');

  // מצב מקומי: expandedTopicId — מזהה; setExpandedTopicId מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    expandedTopicId,
    setExpandedTopicId,
  ] =
    useState<string | null>(
      null,
    );

  // הפניה יציבה contentRef בין רינדורים; שינוי current אינו מפעיל רינדור בפני עצמו.
  const contentRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  // ערך מחושב visibleTopics — הנתון visibleTopics בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const visibleTopics =
    useMemo(
      () =>
        helpTopics.filter(
          (
            topic,
          ) =>
            topicIsVisible(
              topic,
              hasPermission,
            ),
        ),
      [
        hasPermission,
      ],
    );

  // ערך מחושב contextualTopics — הנתון contextualTopics בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const contextualTopics =
    useMemo(
      () =>
        visibleTopics.filter(
          (
            topic,
          ) =>
            topicMatchesRoute(
              topic,
              location.pathname,
              location.search,
            ),
        ),
      [
        location.pathname,
        location.search,
        visibleTopics,
      ],
    );

  // normalizedSearch — הנתון normalizedSearch בהקשר הפעולה.
  const normalizedSearch =
    normalizeSearchValue(
      searchQuery,
    );

  // ערך מחושב filteredTopics — הנתון filteredTopics בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const filteredTopics =
    useMemo(
      () =>
        visibleTopics.filter(
          (
            topic,
          ) =>
            topicMatchesSearch(
              topic,
              normalizedSearch,
            ),
        ),
      [
        normalizedSearch,
        visibleTopics,
      ],
    );

  // ערך מחושב groupedTopics — הנתון groupedTopics בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const groupedTopics =
    useMemo(
      () => {
        // groups — קבוצות; מיפוי לחיפוש לפי מפתח.
        const groups =
          new Map<
            HelpTopic['group'],
            HelpTopic[]
          >();

        // עיבוד כל פריט מתוך filteredTopics בנפרד.
        for (
          const topic
          of filteredTopics
        ) {
          // currentItems — פריטים.
          const currentItems =
            groups.get(
              topic.group,
            ) ?? [];

          currentItems.push(
            topic,
          );

          groups.set(
            topic.group,
            currentItems,
          );
        }

        return Array.from(
          groups.entries(),
        );
      },
      [
        filteredTopics,
      ],
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ isOpen, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isOpen.
      if (!isOpen) {
        return;
      }

      /**
       * פעולה handleEscape: טיפול באירוע עבור הנתון handleEscape בהקשר הפעולה.
       * @param event — אירוע.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleEscape =
        (
          event:
            KeyboardEvent,
        ): void => {
          if (
            event.key ===
              'Escape'
          ) {
            setIsOpen(
              false,
            );
          }
        };

      window.addEventListener(
        'keydown',
        handleEscape,
      );

      return () => {
        window.removeEventListener(
          'keydown',
          handleEscape,
        );
      };
    },
    [
      isOpen,
    ],
  );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ isOpen, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isOpen.
      if (!isOpen) {
        return;
      }

      // previousOverflow — הנתון previousOverflow בהקשר הפעולה.
      const previousOverflow =
        document.body.style.overflow;

      document.body.style.overflow =
        'hidden';

      return () => {
        document.body.style.overflow =
          previousOverflow;
      };
    },
    [
      isOpen,
    ],
  );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ isOpen, normalizedSearch, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isOpen.
      if (!isOpen) {
        return;
      }

      contentRef.current?.scrollTo({
        top: 0,
        behavior: 'auto',
      });
    },
    [
      isOpen,
      normalizedSearch,
    ],
  );

  // defaultContextualTopicId — מזהה.
  const defaultContextualTopicId =
    contextualTopics[0]
      ?.id ??
    null;

  // effectiveExpandedTopicId — מזהה.
  const effectiveExpandedTopicId =
    expandedTopicId ??
    (
      isOpen
        ? defaultContextualTopicId
        : null
    );

  /**
   * פעולה goToTopic: הנתון goToTopic בהקשר הפעולה.
   * @param topic — הנתון topic בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const goToTopic =
    (
      topic:
        HelpTopic,
    ): void => {
      setIsOpen(
        false,
      );

      void navigate(
        topic.route,
      );
    };

  /**
   * פעולה renderTopic: בניית תצוגה עבור הנתון renderTopic בהקשר הפעולה.
   * @param topic — הנתון topic בהקשר הפעולה.
   * @param compact — הנתון compact בהקשר הפעולה.
   */
  const renderTopic =
    (
      topic:
        HelpTopic,

      compact =
        false,
    ) => {
      // isExpanded — הנתון isExpanded בהקשר הפעולה.
      const isExpanded =
        effectiveExpandedTopicId ===
        topic.id;

      return (
        <article
          key={
            topic.id
          }
          className={[
            'help-center-topic',
            compact
              ? 'help-center-topic-contextual'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <button
            type="button"
            className="help-center-topic-toggle"
            aria-expanded={
              isExpanded
            }
            onClick={() => {
              setExpandedTopicId(
                isExpanded
                  ? ''
                  : topic.id,
              );
            }}
          >
            <span>
              <strong>
                {topic.title}
              </strong>

              <small>
                {topic.summary}
              </small>
            </span>

            <ChevronDown
              size={18}
              aria-hidden="true"
              className={
                isExpanded
                  ? 'help-center-topic-chevron help-center-topic-chevron-open'
                  : 'help-center-topic-chevron'
              }
            />
          </button>

          {isExpanded ? (
            <div className="help-center-topic-content">
              <ol>
                {topic.steps.map(
                  (
                    step,
                    index,
                  ) => (
                    <li
                      key={
                        `${topic.id}-${index}`
                      }
                    >
                      {step}
                    </li>
                  ),
                )}
              </ol>

              {topic.notes
                ?.length ? (
                  <div className="help-center-topic-notes">
                    {topic.notes.map(
                      (
                        note,
                      ) => (
                        <p
                          key={
                            note
                          }
                        >
                          {note}
                        </p>
                      ),
                    )}
                  </div>
                ) : null}

              <button
                type="button"
                className="help-center-go-button"
                onClick={() => {
                  goToTopic(
                    topic,
                  );
                }}
              >
                <ExternalLink
                  size={16}
                  aria-hidden="true"
                />

                עבור למסך
              </button>
            </div>
          ) : null}
        </article>
      );
    };

  return (
    <>
      <button
        type="button"
        className="help-center-trigger"
        aria-label="פתיחת מרכז העזרה"
        aria-expanded={
          isOpen
        }
        aria-haspopup="dialog"
        title="מרכז העזרה"
        onClick={() => {
          setExpandedTopicId(
            null,
          );

          setIsOpen(
            true,
          );
        }}
      >
        <HelpCircle
          size={22}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {isOpen
        ? createPortal(
            <>
              <button
            type="button"
            className="help-center-backdrop"
            aria-label="סגירת מרכז העזרה"
            onClick={() => {
              setIsOpen(
                false,
              );
            }}
          />

          <aside
            className="help-center-panel"
            role="dialog"
            aria-modal="true"
            aria-label="מרכז העזרה"
          >
            <header className="help-center-header">
              <div className="help-center-heading">
                <span className="help-center-heading-icon">
                  <BookOpen
                    size={21}
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <strong>
                    מרכז העזרה
                  </strong>

                  <span>
                    ההסברים מותאמים להרשאות שלך
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="help-center-close"
                aria-label="סגירת מרכז העזרה"
                onClick={() => {
                  setIsOpen(
                    false,
                  );
                }}
              >
                <X
                  size={21}
                  aria-hidden="true"
                />
              </button>
            </header>

            <div className="help-center-search">
              <Search
                size={18}
                aria-hidden="true"
              />

              <input
                type="search"
                value={
                  searchQuery
                }
                placeholder="חיפוש פעולה או נושא..."
                aria-label="חיפוש במרכז העזרה"
                onChange={(
                  event,
                ) => {
                  setSearchQuery(
                    event.target.value,
                  );
                }}
              />
            </div>

            <div
              ref={contentRef}
              className="help-center-content"
            >
              {!normalizedSearch ? (
                <aside className="help-center-permission-hint">
                  <strong>
                    לא מוצא פעולה?
                  </strong>

                  <span>
                    ייתכן שהפעולה אינה מופיעה כי לא הוקצתה לך ההרשאה המתאימה. מרכז העזרה מציג רק יכולות שרלוונטיות להרשאות שלך.
                  </span>
                </aside>
              ) : null}

              {!normalizedSearch &&
              contextualTopics.length >
                0 ? (
                  <section className="help-center-context-section">
                    <div className="help-center-section-heading">
                      <strong>
                        עזרה במסך הנוכחי
                      </strong>

                      <span>
                        הפעולות הזמינות לך כאן
                      </span>
                    </div>

                    <div className="help-center-topic-list">
                      {contextualTopics.map(
                        (
                          topic,
                        ) =>
                          renderTopic(
                            topic,
                            true,
                          ),
                      )}
                    </div>
                  </section>
                ) : null}

              <section className="help-center-all-section">
                <div className="help-center-section-heading">
                  <strong>
                    {normalizedSearch
                      ? 'תוצאות חיפוש'
                      : 'כל נושאי העזרה'}
                  </strong>

                  <span>
                    {filteredTopics.length} נושאים זמינים עבורך
                  </span>
                </div>

                {groupedTopics.length >
                0 ? (
                  <div className="help-center-groups">
                    {groupedTopics.map(
                      ([
                        group,
                        topics,
                      ]) => (
                        <section
                          key={
                            group
                          }
                          className="help-center-group"
                        >
                          <h3>
                            {
                              helpGroupLabels[
                                group
                              ]
                            }
                          </h3>

                          <div className="help-center-topic-list">
                            {topics.map(
                              (
                                topic,
                              ) =>
                                renderTopic(
                                  topic,
                                ),
                            )}
                          </div>
                        </section>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="help-center-empty">
                    לא נמצאו נושאי עזרה שמתאימים לחיפוש ולהרשאות שלך.
                  </div>
                )}
              </section>
            </div>
              </aside>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

export default HelpCenter;