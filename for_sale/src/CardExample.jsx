import Card from './Card';

// Example usage of the Card component
export default function CardExample() {
  return (
    <div style={{ padding: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
      {/* Example 1: Full card with all props */}
      <Card
        image="https://via.placeholder.com/350x200"
        title="iPhone 13 Pro"
        description="Excellent condition iPhone 13 Pro with all original accessories. Battery health at 95%."
        price="599"
        category="Electronics"
        condition="Like New"
        location="San Francisco, CA"
        datePosted="2 hours ago"
        seller="John Doe"
        tags={["Phone", "Apple", "Unlocked"]}
      />

      {/* Example 2: Minimal card */}
      <Card
        title="Vintage Bicycle"
        description="Classic road bike in good working condition."
        price="250"
      />

      {/* Example 3: Furniture card */}
      <Card
        image="https://via.placeholder.com/350x200"
        title="Leather Couch"
        description="Beautiful brown leather couch, 3 seater. Moving sale - needs to go ASAP!"
        price="450"
        category="Furniture"
        condition="Used"
        location="Brooklyn, NY"
        seller="Sarah Smith"
        tags={["Furniture", "Living Room", "Leather"]}
      />
    </div>
  );
}
