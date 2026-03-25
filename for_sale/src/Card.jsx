

import './Card.css';

export default function Card({ 
  image, 
  title, 
  description, 
  price, 
  category,
  condition,
  location,
  datePosted,
  seller,
  tags = []
}) {
  return (
    <div className="card">
      {/* Image Section */}
      {image && (
        <div className="card-image">
          <img src={image} alt={title} />
          {condition && <span className="badge-condition">{condition}</span>}
        </div>
      )}

      {/* Content Section */}
      <div className="card-content">
        {/* Category */}
        {category && <span className="card-category">{category}</span>}
        
        {/* Title */}
        <h2 className="card-title">{title}</h2>
        
        {/* Description */}
        <p className="card-description">{description}</p>
        
        {/* Tags */}
        {tags.length > 0 && (
          <div className="card-tags">
            {tags.map((tag, index) => (
              <span key={index} className="tag">{tag}</span>
            ))}
          </div>
        )}
        
        {/* Price */}
        <div className="card-price">
          <span className="price">${price}</span>
        </div>
        
        {/* Footer Info */}
        <div className="card-footer">
          {location && <span className="location">📍 {location}</span>}
          {seller && <span className="seller">👤 {seller}</span>}
          {datePosted && <span className="date">🕒 {datePosted}</span>}
        </div>
      </div>
    </div>
  );
}


