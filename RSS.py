import feedparser
import anthropic
from datetime import datetime

# === CONFIG ===
client = anthropic.Anthropic(api_key="YOUR_CLAUDE_API_KEY_HERE")
RSS_URL = "YOUR_PUBMED_RSS_URL_HERE"

feed = feedparser.parse(RSS_URL)

print("Generating formatted HTML for Today's Latest...\n")

html_output = ""

for entry in feed.entries[:5]:  # Limit to 5 articles
    title = entry.title
    abstract = entry.get('summary', 'No abstract available')
    link = entry.link
    pub_date = entry.get('published', 'Unknown date')
    
    # Ask Claude for 3-4 sentence summary
    prompt = f"""Write a clear, professional 3-4 sentence summary of this trauma research paper for a therapy website.
    Title: {title}
    Abstract: {abstract}
    
    Keep the language approachable but evidence-based. Do not add any extra commentary."""
    
    message = client.messages.create(
        model="claude-3-5-sonnet-20240620",
        max_tokens=500,
        temperature=0.3,
        messages=[{"role": "user", "content": prompt}]
    )
    
    summary = message.content[0].text.strip()
    
    # Format as beautiful HTML article
    html_output += f'''            <article class="border-l-4 border-emerald-600 pl-6">
                <h3 class="text-2xl font-semibold text-[#1A3C5E] mb-3">{title}</h3>
                {summary.replace('\n', '</p>\n                <p class="text-gray-600 mb-2">')}
                <div class="text-sm text-slate-500 mt-4">PubMed • {pub_date[:11]}</div>
            </article>

'''

# Final output
print("=== COPY EVERYTHING BELOW THIS LINE ===\n")
print(html_output)
print("=== END OF HTML BLOCK ===")





