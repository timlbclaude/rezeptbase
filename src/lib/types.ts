// Gemeinsame Domänentypen der App. Die Zeilentypen stammen aus den
// generierten Datenbanktypen (database.types.ts); hier werden sie um das,
// was die Oberfläche zusätzlich braucht, ergänzt (z. B. die Form der
// Kochschritte, die in der Datenbank nur als JSON liegen).
import type { Tables } from './database.types.ts'

export type RecipeRow = Tables<'recipes'>
export type Ingredient = Tables<'ingredients'>
export type ShoppingItem = Tables<'shopping_list'>
export type Collection = Tables<'collections'>
export type RecipeCollectionLink = Tables<'recipe_collections'>
export type CookHistoryEntry = Pick<Tables<'cook_history'>, 'id' | 'cooked_at'>

// Kochschritt als Objekt (seit Ausbaupaket V1.1). Ältere Rezepte halten
// Schritte als reinen Text – beide Formen kommen in recipes.steps vor.
export interface RecipeStep {
  nr?: number
  text: string
  timer_min?: number | null
  zutaten?: string | null
}
export type RawStep = string | RecipeStep

// Rezept mit typisierten Schritten (steps ist in der DB nur Json)
export type Recipe = Omit<RecipeRow, 'steps'> & { steps: RawStep[] }

// Felder, die die Rezeptliste lädt (plus Zutatennamen für die Suche)
export type RecipeListItem = Pick<
  RecipeRow,
  | 'id' | 'title' | 'category' | 'cuisine' | 'description' | 'keywords' | 'image_url' | 'thumb_url'
  | 'prep_time_min' | 'cook_time_min' | 'is_favorite' | 'rating' | 'status' | 'created_at' | 'last_cooked_at'
> & { ingredients: { name: string }[] }

export type RecipeStatus = 'zum_ausprobieren' | 'gekocht'
export type SortKey = 'neueste' | 'bewertung' | 'gekocht' | 'titel'
export type ThemeChoice = 'system' | 'light' | 'dark'
export type ToastType = 'error' | 'success' | 'info'

// Minimale Zutatenform, die die Mengenformatierung braucht
export interface AmountLike {
  name?: string | null
  amount?: number | string | null
  unit?: string | null
  is_scalable?: boolean
}

export function stepText(s: RawStep): string {
  return typeof s === 'string' ? s : s.text
}
