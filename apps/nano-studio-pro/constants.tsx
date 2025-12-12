
import { Preset, PresetType } from './types';
import React from 'react';

export const DEFAULT_LIFESTYLE_PROMPT = "A friendly, light, urban environment on a model. The setting should be a clean city street with soft daylight. No other people, no cars, no street signs, and absolutely no visible text or banners in the background.";

// Using Lucide-react icon names for mapping in components
export const PRESETS: Preset[] = [
  {
    id: PresetType.GHOST_MANNEQUIN,
    label: 'Ghost Mannequin',
    description: 'Remove model, keep 3D shape.',
    icon: 'Shirt',
    promptTemplate: `Edit the provided product image to create a high end, production grade ghost mannequin result.

Completely remove the model or mannequin while preserving the full 3D volumetric shape of the garment. The product must appear naturally filled by an invisible body with realistic structure, correct tension, natural curves, folds and drape. It must never look flat, collapsed, laid on a surface or artificially inflated.

The invisible body is only used to define garment volume and fall. No anatomical details must be visible. Do not show nipples, genitals, muscles, chest definition or any human features.

View must be strictly frontal. No angle, no tilt, no perspective shift.

If the original product appears wrinkled or crumpled, virtually iron and smooth the garment. Remove unwanted wrinkles and creases while fully preserving natural structure, seams, thickness, fabric behavior and material characteristics. Do not over smooth.

Ensure realistic garment fall and silhouette based on the provided <BodyType> input (Men, Women, Kid). The drape must strictly match real world anatomy and cut for the specified body type.
Men: straighter, boxier vertical fall.
Women: more contoured, tapered fall.
Kid: smaller scale, shorter proportions, simplified structure.

Preserve original fabric texture, weave, thickness, weight and surface behavior exactly. Do not change fabric type, stiffness or sheen.

Colors must remain identical to the source image. No color correction, saturation changes, tone shifts or reinterpretation.

Neck opening, collar shape, sleeve volume and armhole structure must remain anatomically correct and consistent with the original cut. No collapsing, stretching or distortion.

Hems, seams and panels must follow realistic gravity and garment construction. No mirrored folds, artificial symmetry or floating edges.

Background must be 100 percent pure white with clean, neutral, professional studio lighting. No shadows, gradients, texture or reflections.

Crop extremely tight. No margins. No padding. No whitespace. The product must touch the edges of the frame and fill the image as much as physically possible.

Maintain absolute accuracy of proportions. Logos, prints, stitching, graphics and text placement must remain 1 to 1 accurate in size and position. Do not distort, resize, redraw or reinterpret any branding elements.

Perspective must stay centered and realistic. Sharp focus across the entire product. No blur. No artistic effects.

Explicit exclusions: no hangers, no pins, no clips, no supports, no floor, no props, no background artifacts, no text overlays, no watermarks.

Final image aspect ratio must be exactly 3:4.`,
  },
  {
    id: PresetType.ANGLES,
    label: 'Multi-Angle Generation',
    description: 'Generate specific views (Front, Side, etc).',
    icon: 'Box',
    promptTemplate: `Edit the provided product image to create a high end, production grade ghost mannequin result.

Completely remove the model or mannequin while preserving the full 3D volumetric shape of the garment. The product must appear naturally filled by an invisible body with realistic structure, correct tension, natural curves, folds and drape. It must never look flat, collapsed, laid on a surface or artificially inflated.

The invisible body is only used to define garment volume and fall. No anatomical details must be visible.

View requirement: {{ANGLE}}.

If the original product appears wrinkled or crumpled, virtually iron and smooth the garment. Remove unwanted wrinkles and creases while fully preserving natural structure, seams, thickness, fabric behavior and material characteristics.

Ensure realistic garment fall and silhouette based on the provided <BodyType> input (Men, Women, Kid). The drape must strictly match real world anatomy and cut for the specified body type.
Men: straighter, boxier vertical fall.
Women: more contoured, tapered fall.
Kid: smaller scale, shorter proportions, simplified structure.

Preserve original fabric texture, weave, thickness, weight and surface behavior exactly. Do not change fabric type, stiffness or sheen.

Colors must remain identical to the source image. No color correction, saturation changes, tone shifts or reinterpretation.

Neck opening, collar shape, sleeve volume and armhole structure must remain anatomically correct and consistent with the original cut.

Background must be 100 percent pure white with clean, neutral, professional studio lighting. No shadows, gradients, texture or reflections.

Crop extremely tight. No margins. No padding. No whitespace. The product must touch the edges of the frame and fill the image as much as physically possible.

Maintain absolute accuracy of proportions. Logos, prints, stitching, graphics and text placement must remain 1 to 1 accurate in size and position.

Perspective must stay centered and realistic. Sharp focus across the entire product. No blur. No artistic effects.

Explicit exclusions: no hangers, no pins, no clips, no supports, no floor, no props, no background artifacts, no text overlays, no watermarks.

Final image aspect ratio must be exactly 3:4.`,
  },
  {
    id: PresetType.BG_REMOVE_REPAIR,
    label: 'Remove BG & Repair',
    description: 'Isolate product & reconstruction.',
    icon: 'Eraser',
    promptTemplate: `Create a high end, production grade background removal and product repair result for ecommerce use.

Completely remove the background and isolate the product cleanly. No cutout artifacts, no halos, no fringing, no transparency errors.

If any part of the product is occluded by hands, models or objects, fully reconstruct the hidden areas so the product appears complete, intact and brand new. Reconstructed parts must be geometrically, materially and visually consistent with the original product. No guessed details, no design changes, no simplification.

Product accuracy has absolute priority. Colors, materials, textures, proportions, logos, prints, stitching, graphics and construction details must remain 1 to 1 accurate. In no case may branding elements be altered, resized, redrawn or reinterpreted.

Preserve original fabric texture, surface finish, thickness and material behavior. No over smoothing. No artificial sharpening. No plastic look.

Edges must be precise and natural. Maintain correct contours, cut lines and silhouette. No warping, stretching or deformation.

Repair must respect real world construction. Seams, panels, hems, edges and joins must align perfectly and follow realistic garment or product logic.

Lighting must remain neutral, clean and consistent across the entire product. No dramatic lighting, no shadows baked into the product, no highlights added that did not exist.

The final background must be clean and uniform, suitable for ecommerce. Default to pure white unless otherwise specified. No gradients, no texture, no shadows, no reflections.

Crop clean and balanced. Center the product. No unnecessary whitespace. Do not cut off any part of the product.

Explicit exclusions: no text overlays, no watermarks, no UI elements, no props, no artificial effects, no stylization.

The final result must look like a flawless, untouched product shot ready for a professional webshop.`,
  },
  {
    id: PresetType.LIFESTYLE,
    label: 'Lifestyle Shot',
    description: 'Product in a realistic environment.',
    icon: 'Image',
    promptTemplate: `Create a high end, production grade lifestyle image for an ecommerce shop.

Place the product in a realistic, believable real world environment that matches its intended use and target audience. The scene must feel natural, premium and contemporary. No staged or artificial look.

If the product is apparel, it must be worn naturally by a suitable model or implied body presence. Fit, drape and posture must be realistic and appropriate for the product and the provided <BodyType> input (Men, Women, Kid). No exaggerated poses. No sexualized presentation. No distorted anatomy.

If the product is a hardgood or accessory, place it in a context where it would realistically be used or owned. Scale, orientation and interaction with the environment must be physically correct.

Lighting must be natural and coherent with the environment. Soft daylight or realistic indoor lighting only. No harsh studio lighting, no artificial rim lights, no dramatic effects.

Background and surroundings must support the product without distracting from it. Clean, minimal, authentic environments.

No visible text, banners, signage, graffiti, labels or readable typography anywhere in the image. The only allowed text is the original logo, print or branding that is physically part of the product itself.

Product accuracy has absolute priority. Even if a reference image is provided, the product must remain 1 to 1 accurate to the original. In no case may colors, graphics, logos, prints, stitching, proportions, materials or construction details be altered, simplified or reinterpreted. Reference images must only influence environment and mood, never the product itself.

The product must remain the clear visual focus. Sharp focus on the product. Slight natural depth of field in the background is allowed but must not blur product details.

Preserve realistic material behavior. Fabric, surfaces and finishes must react naturally to light, gravity and movement. No plastic look. No over smoothing.

Composition must feel editorial but commercial. Balanced framing, natural crop, no awkward cut offs. Do not crop through logos, graphics or key product features.

Explicit exclusions: no text overlays, no watermarks, no UI elements, no artificial effects, no filters, no props that compete with the product, no misleading context.

The final image must look like a premium lifestyle shot used by a top tier ecommerce brand.`,
  }
];
