import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <section>
      <h1>העמוד לא נמצא</h1>
      <p>הכתובת שאליה הגעת אינה קיימת.</p>

      <Link to="/">חזרה ללוח הבקרה</Link>
    </section>
  );
}

export default NotFoundPage;